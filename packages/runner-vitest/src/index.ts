import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import type { ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { runProcess, type ProcessResult } from './process.js'

const DIAGNOSTIC_LIMIT = 8_000
const REPORT_LIMIT = 4_000_000

type ListedTest = { readonly file: string; readonly name: string }
type Assertion = {
  readonly file: string
  readonly ancestorTitles: readonly string[]
  readonly title: string
  readonly status: string
  readonly failureMessages?: readonly string[]
}
type Report = {
  readonly testResults: readonly { readonly assertionResults: readonly Assertion[]; readonly message?: string }[]
  readonly numRuntimeErrorTestSuites?: number
}

interface CommandOptions {
  readonly command: string
  readonly commandArgs: readonly string[]
}

function commandOptions(value: unknown): CommandOptions {
  if (value === null) return { command: process.execPath, commandArgs: [] }
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Vitest runner options must be an object or null')
  const options = value as Record<string, unknown>
  if (Object.keys(options).some(key => key !== 'command' && key !== 'commandArgs')) throw new Error('Vitest runner options contain unsupported fields')
  const command = options.command === undefined ? process.execPath : options.command
  const commandArgs = options.commandArgs === undefined ? [] : options.commandArgs
  if (typeof command !== 'string' || command.length === 0 || command.includes('\0')) {
    throw new Error('Vitest runner option command must be a nonempty string')
  }
  if (!Array.isArray(commandArgs) || !commandArgs.every(item => typeof item === 'string' && !item.includes('\0'))) {
    throw new Error('Vitest runner option commandArgs must be an array of strings')
  }
  return { command, commandArgs }
}

async function vitestCli(projectRoot: string): Promise<string> {
  const require = createRequire(resolve(projectRoot, 'package.json'))
  let manifestPath: string
  try {
    manifestPath = require.resolve('vitest/package.json')
  } catch {
    throw new Error(`Vitest is not installed for project ${projectRoot}`)
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { readonly bin?: unknown }
  const bin = typeof manifest.bin === 'object' && manifest.bin !== null && !Array.isArray(manifest.bin)
    ? (manifest.bin as Record<string, unknown>).vitest
    : undefined
  if (typeof bin !== 'string' || bin.length === 0 || isAbsolute(bin)) throw new Error('Installed Vitest package has no valid vitest executable')
  const packageRoot = dirname(manifestPath)
  const cli = resolve(packageRoot, bin)
  const path = relative(packageRoot, cli)
  if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('Installed Vitest executable leaves its package')
  return cli
}

function parseSelector(selector: string): { readonly file: string; readonly name: string } | undefined {
  const split = selector.indexOf('::')
  if (split < 1 || split === selector.length - 2) return undefined
  return { file: selector.slice(0, split), name: selector.slice(split + 2) }
}

function projectFile(root: string, file: string): string | undefined {
  if (file.includes('\\')) return undefined
  const absolute = resolve(root, file)
  const path = relative(resolve(root), absolute).split(sep).join('/')
  return path !== '' && path !== '..' && !path.startsWith('../') && path === file ? absolute : undefined
}

function parseJson<T>(output: string, operation: string): T {
  try {
    return JSON.parse(output) as T
  } catch {
    throw new Error(`Vitest ${operation} did not produce valid JSON`)
  }
}

function collectorArguments(): string[] {
  const compiled = fileURLToPath(new URL('./collect.js', import.meta.url))
  if (existsSync(compiled)) return [compiled]
  const source = fileURLToPath(new URL('./collect.ts', import.meta.url))
  return process.features.typescript ? [source] : ['--experimental-strip-types', source]
}

function diagnostic(process: ProcessResult): string {
  return (process.stderr || process.stdout).trim().slice(-DIAGNOSTIC_LIMIT)
}

async function executeWithReport(
  command: CommandOptions,
  api: string,
  selected: readonly { readonly file: string; readonly names: readonly string[] }[],
  cwd: string,
  signal: AbortSignal,
): Promise<{ readonly process: ProcessResult; readonly report: Report }> {
  const directory = await mkdtemp(join(tmpdir(), 'focused-spec-vitest-report-'))
  const reportPath = join(directory, 'report.json')
  try {
    const processResult = await runProcess(command.command, [...command.commandArgs, ...collectorArguments(), api, reportPath, JSON.stringify(selected.map(selection => selection.file)), JSON.stringify(selected)], cwd, signal)
    let size: number
    try {
      size = (await stat(reportPath)).size
    } catch {
      throw new Error(`Vitest execution produced no JSON report${diagnostic(processResult) === '' ? '' : `: ${diagnostic(processResult)}`}`)
    }
    if (size > REPORT_LIMIT) throw new Error(`Vitest JSON report exceeded ${REPORT_LIMIT} bytes`)
    const report = parseJson<Report>(await readFile(reportPath, 'utf8'), 'execution')
    return { process: processResult, report }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export default {
  apiVersion: 1,
  async resolve(request) {
    await vitestCli(request.projectRoot)
    const command = commandOptions(request.options)
    const directory = await mkdtemp(join(tmpdir(), 'focused-spec-vitest-collection-'))
    const output = join(directory, 'tests.json')
    const collector = collectorArguments()
    const api = createRequire(resolve(request.projectRoot, 'package.json')).resolve('vitest/node')
    const filters = [...new Set(request.selectors.flatMap(selector => {
      const parsed = parseSelector(selector)
      return parsed !== undefined && projectFile(request.projectRoot, parsed.file) !== undefined ? [parsed.file] : []
    }))]
    let tests: ListedTest[]
    try {
      const listed = await runProcess(command.command, [...command.commandArgs, ...collector, api, output, JSON.stringify(filters)], request.cwd, request.signal)
      if (listed.code !== 0) throw new Error(`Vitest discovery failed${diagnostic(listed) === '' ? '' : `: ${diagnostic(listed)}`}`)
      if ((await stat(output)).size > REPORT_LIMIT) throw new Error('Vitest collection exceeded the report limit')
      tests = parseJson<ListedTest[]>(await readFile(output, 'utf8'), 'discovery')
      if (!Array.isArray(tests)) throw new Error('Vitest discovery returned no test list')
    } finally { await rm(directory, { recursive: true, force: true }) }
    const root = await realpath(request.projectRoot)
    const counts = new Map<string, number>()
    for (const test of tests) {
      if (typeof test?.file !== 'string' || typeof test.name !== 'string') throw new Error('Vitest discovery returned a malformed test')
      const file = relative(root, await realpath(test.file)).split(sep).join('/')
      if (file === '..' || file.startsWith('../') || isAbsolute(file)) continue
      const key = `${file}::${test.name}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      const selected = parseSelector(selector)
      if (selected === undefined || projectFile(request.projectRoot, selected.file) === undefined) {
        errors.push({ selector, message: 'expected a project-relative test file::full Vitest test name' })
        continue
      }
      const count = counts.get(selector) ?? 0
      if (count !== 1) {
        errors.push({ selector, message: count === 0 ? `Vitest test not found: ${selector}` : `Vitest test is ambiguous (${count} matches): ${selector}` })
        continue
      }
      targets.push({ selector, targetId: selector, displayName: selected.name, source: { path: selected.file } })
    }
    return { targets, errors }
  },

  async run(request) {
    await vitestCli(request.projectRoot)
    const api = createRequire(resolve(request.projectRoot, 'package.json')).resolve('vitest/node')
    const command = commandOptions(request.options)
    const files = new Map<string, Map<string, ResolvedTarget>>()
    for (const target of request.targets) {
      const selected = parseSelector(target.selector)
      const file = selected === undefined ? undefined : projectFile(request.projectRoot, selected.file)
      if (selected === undefined || file === undefined) throw new Error(`Invalid Vitest target ${target.selector}`)
      let tests = files.get(file)
      if (tests === undefined) {
        tests = new Map()
        files.set(file, tests)
      }
      if (tests.has(selected.name)) throw new Error(`Duplicate Vitest target ${target.selector}`)
      tests.set(selected.name, target)
    }

    const selected = await Promise.all([...files].map(async ([file, tests]) => ({ file: await realpath(file), names: [...tests.keys()] })))
    const execution = await executeWithReport(command, api, selected, request.cwd, request.signal)
    const report = execution.report
    if (!Array.isArray(report.testResults)) throw new Error('Vitest returned no execution results')
    const suiteMessages = report.testResults.map(result => result.message ?? '').filter(message => message !== '')
    if ((report.numRuntimeErrorTestSuites ?? 0) > 0 || suiteMessages.length > 0) {
      throw new Error(`Vitest suite failed: ${(suiteMessages.join('\n') || diagnostic(execution.process)).slice(-DIAGNOSTIC_LIMIT)}`)
    }
    const assertions = report.testResults.flatMap(result => result.assertionResults)
    if (execution.process.code !== 0 && !assertions.some(assertion => assertion.status === 'failed')) {
      throw new Error(`Vitest exited ${execution.process.code}${diagnostic(execution.process) === '' ? '' : `: ${diagnostic(execution.process)}`}`)
    }
    const resultByTarget = new Map<string, TargetResult>()
    for (const [index, [, tests]] of [...files].entries()) {
      const file = selected[index]!.file
      for (const [name, target] of tests) {
        const matching = assertions.filter(assertion => assertion.file === file && [...assertion.ancestorTitles, assertion.title].join(' > ') === name)
        if (matching.length !== 1) throw new Error(`Vitest reported ${matching.length} results for ${target.selector}`)
        const assertion = matching[0]!
        const status = assertion.status === 'passed' ? 'pass'
          : assertion.status === 'failed' ? 'fail'
            : assertion.status === 'skipped' || assertion.status === 'todo' ? 'skip'
              : undefined
        if (status === undefined) throw new Error(`Vitest reported nonterminal status ${assertion.status} for ${target.selector}`)
        const failure = (assertion.failureMessages ?? []).join('\n').slice(-DIAGNOSTIC_LIMIT)
        resultByTarget.set(target.targetId, { targetId: target.targetId, status, ...(failure === '' ? {} : { diagnostic: failure }) })
      }
    }
    return {
      results: request.targets.map(target => {
        const result = resultByTarget.get(target.targetId)
        if (result === undefined) throw new Error(`Vitest runner lost target ${target.targetId}`)
        return result
      }),
    }
  },
} satisfies RunnerPlugin
