import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JsonValue, ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { runProcess, type ProcessResult } from './process.js'

const REPORT_LIMIT = 4_000_000
const DIAGNOSTIC_LIMIT = 8_000

interface CommandOptions {
  readonly command: string
  readonly commandArgs: readonly string[]
}
interface PhaseReport {
  readonly nodeid: string
  readonly phase: 'setup' | 'call' | 'teardown'
  readonly outcome: 'passed' | 'failed' | 'skipped'
  readonly diagnostic: string
}
interface PytestReport {
  readonly collected: readonly string[]
  readonly collectionErrors: readonly string[]
  readonly reports: readonly PhaseReport[]
  readonly exitStatus: number
}
interface PytestTargetData {
  readonly nodeid: string
}

function commandOptions(value: unknown): CommandOptions {
  if (value === null) return { command: 'python', commandArgs: [] }
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('pytest runner options must be an object or null')
  const options = value as Record<string, unknown>
  if (Object.keys(options).some(key => key !== 'command' && key !== 'commandArgs')) throw new Error('pytest runner options contain unsupported fields')
  const command = options.command === undefined ? 'python' : options.command
  const commandArgs = options.commandArgs === undefined ? [] : options.commandArgs
  if (typeof command !== 'string' || command.length === 0 || command.includes('\0')) {
    throw new Error('pytest runner option command must be a nonempty string')
  }
  if (!Array.isArray(commandArgs) || !commandArgs.every(item => typeof item === 'string' && !item.includes('\0'))) {
    throw new Error('pytest runner option commandArgs must be an array of strings')
  }
  return { command, commandArgs }
}

function parseSelector(projectRoot: string, selector: string): { readonly argument: string; readonly path: string } | undefined {
  const separator = selector.indexOf('::')
  const file = separator === -1 ? selector : selector.slice(0, separator)
  if (file.length === 0 || file.includes('\\')) return undefined
  const absolute = resolve(projectRoot, file)
  const path = relative(resolve(projectRoot), absolute).split(sep).join('/')
  if (path === '' || path === '..' || path.startsWith('../') || path !== file || isAbsolute(path)) return undefined
  const suffix = separator === -1 ? '' : selector.slice(separator)
  if (suffix === '::') return undefined
  return { argument: `${absolute}${suffix}`, path }
}

function parseTargetData(value: JsonValue | undefined): PytestTargetData | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const nodeid = (value as Record<string, JsonValue>).nodeid
  return typeof nodeid === 'string' && nodeid.length > 0 ? { nodeid } : undefined
}

function processDiagnostic(process: ProcessResult): string {
  return (process.stderr || process.stdout).trim().slice(-DIAGNOSTIC_LIMIT)
}

async function pytest(
  options: CommandOptions,
  args: readonly string[],
  cwd: string,
  signal: AbortSignal,
): Promise<{ readonly process: ProcessResult; readonly report: PytestReport }> {
  const directory = await mkdtemp(join(tmpdir(), 'focused-spec-pytest-report-'))
  const reportPath = join(directory, 'report.json')
  const helperDirectory = dirname(fileURLToPath(new URL('../python/_focused_spec_reporter.py', import.meta.url)))
  const pythonPath = process.env.PYTHONPATH
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONPATH: pythonPath === undefined || pythonPath === '' ? helperDirectory : `${helperDirectory}${delimiter}${pythonPath}` }
  try {
    const processResult = await runProcess(
      options.command,
      [...options.commandArgs, '-m', 'pytest', '-p', '_focused_spec_reporter', '--focused-spec-report', reportPath, '-q', ...args],
      cwd,
      signal,
      env,
    )
    let size: number
    try {
      size = (await stat(reportPath)).size
    } catch {
      throw new Error(`pytest produced no result report${processDiagnostic(processResult) === '' ? '' : `: ${processDiagnostic(processResult)}`}`)
    }
    if (size > REPORT_LIMIT) throw new Error(`pytest result report exceeded ${REPORT_LIMIT} bytes`)
    let report: PytestReport
    try {
      report = JSON.parse(await readFile(reportPath, 'utf8')) as PytestReport
    } catch {
      throw new Error('pytest produced a malformed result report')
    }
    if (!Array.isArray(report.collected) || !report.collected.every(item => typeof item === 'string')
      || !Array.isArray(report.collectionErrors) || !report.collectionErrors.every(item => typeof item === 'string')
      || !Array.isArray(report.reports) || typeof report.exitStatus !== 'number') {
      throw new Error('pytest produced a malformed result report')
    }
    return { process: processResult, report }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const options = commandOptions(request.options)
    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      const selected = parseSelector(request.projectRoot, selector)
      if (selected === undefined) {
        errors.push({ selector, message: 'expected a project-relative pytest node ID' })
        continue
      }
      const discovery = await pytest(options, ['--collect-only', selected.argument], request.cwd, request.signal)
      if (discovery.report.collectionErrors.length > 0) {
        errors.push({ selector, message: discovery.report.collectionErrors.join('\n').slice(-DIAGNOSTIC_LIMIT) })
        continue
      }
      const collected = discovery.report.collected
      if (collected.length !== 1) {
        errors.push({
          selector,
          message: collected.length === 0
            ? `pytest test not found: ${selector}${processDiagnostic(discovery.process) === '' ? '' : ` (${processDiagnostic(discovery.process)})`}`
            : `pytest selector is ambiguous (${collected.length} matches): ${selector}`,
        })
        continue
      }
      const nodeid = collected[0]!
      targets.push({ selector, targetId: selector, displayName: nodeid, source: { path: selected.path }, data: { nodeid } })
    }
    return { targets, errors }
  },

  async run(request) {
    const options = commandOptions(request.options)
    const selected: { readonly target: ResolvedTarget; readonly argument: string; readonly nodeid: string }[] = []
    const nodeids = new Set<string>()
    for (const target of request.targets) {
      const parsed = parseSelector(request.projectRoot, target.selector)
      const data = parseTargetData(target.data)
      if (parsed === undefined || data === undefined) throw new Error(`Invalid pytest target ${target.selector}`)
      if (nodeids.has(data.nodeid)) throw new Error(`Duplicate pytest target ${target.selector}`)
      nodeids.add(data.nodeid)
      selected.push({ target, argument: parsed.argument, nodeid: data.nodeid })
    }
    if (selected.length === 0) return { results: [] }

    const execution = await pytest(options, selected.map(item => item.argument), request.cwd, request.signal)
    if (execution.report.collectionErrors.length > 0) {
      throw new Error(`pytest collection failed: ${execution.report.collectionErrors.join('\n').slice(-DIAGNOSTIC_LIMIT)}`)
    }
    const collected = new Set(execution.report.collected)
    if ([...collected].some(nodeid => !nodeids.has(nodeid))) throw new Error('pytest execution collected an unrequested test')

    const results: TargetResult[] = selected.map(({ target, nodeid }) => {
      const phases = execution.report.reports.filter(report => report.nodeid === nodeid)
      const failed = phases.filter(report => report.outcome === 'failed')
      const skipped = phases.filter(report => report.outcome === 'skipped')
      const call = phases.filter(report => report.phase === 'call')
      const setup = phases.filter(report => report.phase === 'setup')
      const teardown = phases.filter(report => report.phase === 'teardown')
      const diagnostic = [...failed, ...skipped].map(report => report.diagnostic).filter(Boolean).join('\n').slice(-DIAGNOSTIC_LIMIT)
      if (!collected.has(nodeid) || phases.length === 0) {
        const detail = processDiagnostic(execution.process)
        return { targetId: target.targetId, status: 'fail', diagnostic: detail === '' ? `pytest did not report ${nodeid}` : detail }
      }
      if (failed.length > 0) return { targetId: target.targetId, status: 'fail', ...(diagnostic === '' ? {} : { diagnostic }) }
      if (skipped.length > 0) return { targetId: target.targetId, status: 'skip', ...(diagnostic === '' ? {} : { diagnostic }) }
      const complete = setup.length === 1 && setup[0]!.outcome === 'passed'
        && call.length === 1 && call[0]!.outcome === 'passed'
        && teardown.length === 1 && teardown[0]!.outcome === 'passed'
      return complete
        ? { targetId: target.targetId, status: 'pass' }
        : { targetId: target.targetId, status: 'fail', diagnostic: `pytest did not report complete setup/call/teardown phases for ${nodeid}` }
    })
    if (execution.process.code !== 0 && results.every(result => result.status !== 'fail')) {
      throw new Error(`pytest exited ${execution.process.code}${processDiagnostic(execution.process) === '' ? '' : `: ${processDiagnostic(execution.process)}`}`)
    }
    return { results }
  },
} satisfies RunnerPlugin
