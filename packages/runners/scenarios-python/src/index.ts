import { createHash, randomBytes } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeSelector, readCatalog, readDriver, validPythonCommand } from '@focused-spec/format-scenarios-python/catalog'
import type { Catalog, CatalogScenario } from '@focused-spec/format-scenarios-python/catalog'
import { retainExecutionEvents } from 'focused-spec/runner'
import type { ExecutionEvent, ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { executePythonWorker, TRANSPORT_LIMIT } from './process.js'

const WORKER = fileURLToPath(new URL('./python/worker.py', import.meta.url))

interface RunnerOptions {
  readonly command: string
}

function runnerOptions(value: unknown): RunnerOptions {
  if (value === null || value === undefined) return { command: 'python3' }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Python scenario runner options must be null or { command?: "python3" }')
  }
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).some(key => key !== 'command')
    || (candidate.command !== undefined && (typeof candidate.command !== 'string' || !validPythonCommand(candidate.command)))) {
    throw new Error('Python scenario runner options must be exactly { command?: "<Python executable>" }')
  }
  return { command: typeof candidate.command === 'string' ? candidate.command : 'python3' }
}

async function containedFile(root: string, path: string): Promise<string> {
  const canonical = await realpath(path)
  const part = relative(root, canonical)
  if (!part || part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new Error(`path escapes the project: ${path}`)
  const info = await stat(canonical)
  if (!info.isFile() || info.size > TRANSPORT_LIMIT) throw new Error(`expected a Python source file no larger than ${TRANSPORT_LIMIT} bytes: ${path}`)
  return canonical
}

async function source(root: string, path: string): Promise<string> {
  const canonical = await containedFile(root, path)
  const value = await readFile(canonical, 'utf8')
  if (Buffer.byteLength(value) > TRANSPORT_LIMIT) throw new Error(`Python source exceeds ${TRANSPORT_LIMIT} bytes: ${path}`)
  return value
}

async function selected(projectRoot: string, selector: string, command: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const root = await realpath(projectRoot)
  if (!(await stat(root)).isDirectory()) throw new Error('Python project root must be a directory')
  const [path, id] = decodeSelector(selector)
  const suitePath = await containedFile(root, resolve(root, path))
  const catalog = await readCatalog(path, await source(root, suitePath), signal, command)
  const entry = catalog.scenarios.find(value => value.id === id)
  if (!entry) throw new Error(`scenario not found: ${id} in ${path}`)
  const binding = catalog.suite.driver
  if (isAbsolute(binding.path) || /^[a-z]:/iu.test(binding.path) || /[\\\u0000-\u001f\u007f-\u009f]/u.test(binding.path) || !binding.path.endsWith('.py')) {
    throw new Error('driver must name a project-contained relative .py source path')
  }
  const driverPath = await containedFile(root, resolve(dirname(suitePath), binding.path))
  const driver = await readDriver(binding.path, await source(root, driverPath), binding.exportName, signal, command)
  if (driver.exportName !== binding.exportName) throw new Error('Python driver binding did not resolve exactly')
  signal.throwIfAborted()
  return { root, path, suitePath, driverPath, catalog, entry }
}

interface Selected {
  readonly root: string
  readonly path: string
  readonly suitePath: string
  readonly driverPath: string
  readonly catalog: Catalog
  readonly entry: CatalogScenario
}

function targetIdentity(selector: string): string {
  return createHash('sha256').update(selector).digest('hex')
}

function diagnostic(error: unknown): string {
  return (error instanceof Error ? (error.stack ?? error.message) : String(error)).slice(-8_000)
}

function reportResults(text: string, nonce: string, targets: readonly ResolvedTarget[]): TargetResult[] {
  let report: unknown
  try {
    report = JSON.parse(text)
  } catch {
    throw new Error('Python execution report contains malformed JSON')
  }
  if (report === null || typeof report !== 'object' || Array.isArray(report)) throw new Error('invalid Python execution report')
  const document = report as Record<string, unknown>
  if (Object.keys(document).some(key => key !== 'protocol' && key !== 'nonce' && key !== 'results')
    || document.protocol !== 1 || document.nonce !== nonce || !Array.isArray(document.results)
    || document.results.length !== targets.length) {
    throw new Error('invalid or missing selected Python execution report')
  }
  const expected = new Set(targets.map(target => target.targetId))
  const results = new Map<string, Omit<TargetResult, 'targetId'>>()
  for (const value of document.results) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Python execution result')
    const entry = value as Record<string, unknown>
    if (Object.keys(entry).some(key => key !== 'targetId' && key !== 'status' && key !== 'diagnostic' && key !== 'events')
      || typeof entry.targetId !== 'string' || !expected.has(entry.targetId) || results.has(entry.targetId)
      || (entry.status !== 'pass' && entry.status !== 'fail')
      || (entry.diagnostic !== undefined && (typeof entry.diagnostic !== 'string' || entry.diagnostic.length > 8_000))) {
      throw new Error('invalid or duplicate Python execution result')
    }
    let events: readonly ExecutionEvent[]
    try {
      events = retainExecutionEvents(entry.events)
    } catch (error) {
      throw new Error(`invalid Python execution events: ${error instanceof Error ? error.message : String(error)}`)
    }
    results.set(entry.targetId, {
      status: entry.status,
      ...(typeof entry.diagnostic === 'string' ? { diagnostic: entry.diagnostic } : {}),
      events,
    })
  }
  return targets.map(target => {
    const result = results.get(target.targetId)
    if (!result) throw new Error(`selected Python execution report missing: ${target.selector}`)
    return { targetId: target.targetId, ...result }
  })
}

async function runSuite(
  value: Selected,
  targets: readonly ResolvedTarget[],
  command: string,
  cwd: string,
  signal: AbortSignal,
): Promise<TargetResult[]> {
  const nonce = randomBytes(32).toString('hex')
  const selectedEntries = targets.map(target => {
    const [, id] = decodeSelector(target.selector)
    const entry = value.catalog.scenarios.find(candidate => candidate.id === id)
    if (!entry) throw new Error(`scenario not found: ${id}`)
    return { targetId: target.targetId, id: entry.id, name: entry.name }
  })
  const outcome = await executePythonWorker(command, WORKER, {
    protocol: 1,
    nonce,
    projectRoot: value.root,
    suitePath: value.suitePath,
    suiteExport: value.catalog.suite.exportName,
    driverPath: value.driverPath,
    driverExport: value.catalog.suite.driver.exportName,
    driverBinding: { path: value.catalog.suite.driver.path, export: value.catalog.suite.driver.exportName },
    inventory: value.catalog.scenarios.map(entry => ({ id: entry.id, name: entry.name })),
    selected: selectedEntries,
  }, cwd, signal)
  if (outcome.report !== undefined) return reportResults(outcome.report, nonce, targets)
  if (outcome.code !== 0) {
    throw new Error((outcome.stderr.trim() || outcome.stdout.trim() || `Python worker exited ${outcome.code}`).slice(-8_000))
  }
  throw new Error('missing selected Python execution report')
}

export default {
  apiVersion: 1,
  async resolve(request) {
    const { command } = runnerOptions(request.options)
    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      try {
        const value = await selected(request.projectRoot, selector, command, request.signal)
        targets.push({
          selector,
          targetId: targetIdentity(selector),
          displayName: value.entry.name,
          source: { path: value.path, line: value.entry.line },
        })
      } catch (error) {
        request.signal.throwIfAborted()
        errors.push({ selector, message: error instanceof Error ? error.message : String(error) })
      }
    }
    return { targets, errors }
  },
  async run(request) {
    const { command } = runnerOptions(request.options)
    const results: TargetResult[] = []
    const groups = new Map<string, { value: Selected; targets: ResolvedTarget[] }>()
    for (const target of request.targets) {
      try {
        if (target.targetId !== targetIdentity(target.selector)) throw new Error('Python target identity does not match selector')
        const value = await selected(request.projectRoot, target.selector, command, request.signal)
        const group = groups.get(value.path)
        if (group) group.targets.push(target)
        else groups.set(value.path, { value, targets: [target] })
      } catch (error) {
        request.signal.throwIfAborted()
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: diagnostic(error) })
      }
    }
    for (const { value, targets } of groups.values()) {
      try {
        results.push(...await runSuite(value, targets, command, request.cwd, request.signal))
      } catch (error) {
        request.signal.throwIfAborted()
        results.push(...targets.map(target => ({ targetId: target.targetId, status: 'fail' as const, diagnostic: diagnostic(error) })))
      }
    }
    return { results }
  },
} satisfies RunnerPlugin
