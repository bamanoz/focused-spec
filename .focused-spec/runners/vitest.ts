import { spawn } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type { RunnerPlugin, ResolvedTarget, TargetResult } from 'focused-spec/runner'

const OUTPUT_LIMIT = 2_000_000
const DIAGNOSTIC_LIMIT = 4_000

type ListedTest = { file: string; name: string }
type Assertion = { ancestorTitles: string[]; title: string; status: string; failureMessages?: string[] }
type Report = { testResults: { assertionResults: Assertion[] }[] }

async function vitest(args: string[], root: string, cwd: string, signal: AbortSignal): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), ...args], {
    cwd,
    signal,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let overflow = false
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += String(chunk)
    if (stdout.length > OUTPUT_LIMIT) {
      overflow = true
      child.kill()
    }
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + String(chunk)).slice(-DIAGNOSTIC_LIMIT)
  })
  const code = await new Promise<number>((done, reject) => {
    child.once('error', reject)
    child.once('close', value => done(value ?? 1))
  })
  if (overflow) throw new Error('Vitest output exceeded the limit')
  return { code, stdout, stderr }
}

function parseSelector(selector: string): { file: string; name: string } | undefined {
  const split = selector.indexOf('::')
  if (split < 1 || split === selector.length - 2) return undefined
  return { file: selector.slice(0, split), name: selector.slice(split + 2) }
}

function projectFile(root: string, file: string): string | undefined {
  const absolute = resolve(root, file)
  const path = relative(root, absolute)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && path === file ? absolute : undefined
}

function json<T>(output: string, operation: string): T {
  try {
    return JSON.parse(output) as T
  } catch {
    throw new Error(`Vitest ${operation} did not produce valid JSON`)
  }
}

function pattern(name: string): string {
  return `^${name.split(' > ').join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const listed = await vitest(['list', '--json'], request.projectRoot, request.cwd, request.signal)
    if (listed.code !== 0) throw new Error(`Vitest discovery failed: ${listed.stderr || listed.stdout.slice(-DIAGNOSTIC_LIMIT)}`)
    const tests = json<ListedTest[]>(listed.stdout, 'discovery')
    if (!Array.isArray(tests)) throw new Error('Vitest discovery returned no test list')
    const root = await realpath(request.projectRoot)
    const counts = new Map<string, number>()
    for (const test of tests) {
      const file = relative(root, await realpath(test.file)).split(sep).join('/')
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
    const results: TargetResult[] = []
    for (const target of request.targets) {
      const selected = parseSelector(target.selector)
      if (selected === undefined || projectFile(request.projectRoot, selected.file) === undefined) {
        throw new Error(`Invalid Vitest target ${target.selector}`)
      }
      const output = await vitest(['run', selected.file, '--testNamePattern', pattern(selected.name), '--reporter=json'], request.projectRoot, request.cwd, request.signal)
      const report = json<Report>(output.stdout, 'execution')
      if (!Array.isArray(report.testResults)) throw new Error('Vitest returned no execution results')
      const assertions = report.testResults.flatMap(result => result.assertionResults)
        .filter(assertion => [...assertion.ancestorTitles, assertion.title].join(' > ') === selected.name)
      if (assertions.length !== 1) throw new Error(`Vitest selected ${assertions.length} tests for ${target.selector}`)
      const assertion = assertions[0]!
      const status = assertion.status === 'passed' && output.code === 0 ? 'pass'
        : assertion.status === 'failed' ? 'fail'
          : assertion.status === 'skipped' && output.code === 0 ? 'skip' : undefined
      if (status === undefined) throw new Error(`Vitest exited ${output.code} with test status ${assertion.status}: ${output.stderr}`)
      const diagnostic = (assertion.failureMessages ?? []).join('\n').slice(-DIAGNOSTIC_LIMIT)
      results.push({ targetId: target.targetId, status, ...(diagnostic === '' ? {} : { diagnostic }) })
    }
    return { results }
  },
} satisfies RunnerPlugin
