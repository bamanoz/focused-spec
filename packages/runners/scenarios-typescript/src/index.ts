import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { decodeSelector, readCatalog } from '@focused-spec/format-scenarios-typescript/catalog'
import type { Scenario } from '@focused-spec/scenarios-typescript'
import type { ResolvedTarget, RunnerPlugin, TargetResult } from 'focused-spec/runner'
import { execute } from './process.js'

export interface WorkItem {
  readonly targetId: string
  readonly driver: string
  readonly scenario: Scenario
}

function checkOptions(options: unknown): void {
  if (options !== null && (typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length !== 0)) {
    throw new Error('scenario runner options must be null or an empty object')
  }
}

async function contained(root: string, path: string): Promise<string> {
  const canonical = await realpath(path)
  const part = relative(root, canonical)
  if (!part || part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new Error(`path escapes the project: ${path}`)
  if (!(await stat(canonical)).isFile()) throw new Error(`expected a module file: ${path}`)
  return canonical
}

async function selected(projectRoot: string, selector: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const [path, id] = decodeSelector(selector)
  const root = await realpath(projectRoot)
  const suitePath = await contained(root, resolve(root, path))
  const catalog = readCatalog(path, await readFile(suitePath, 'utf8'))
  const entry = catalog.scenarios.find(entry => entry.scenario.id === id)
  if (entry === undefined) throw new Error(`scenario not found: ${id} in ${path}`)
  const authoredDriver = catalog.suite.driver
  if (isAbsolute(authoredDriver) || /^[a-z]:/iu.test(authoredDriver) || authoredDriver.includes('\\') || !/\.(?:m?js|m?ts)$/u.test(authoredDriver)) {
    throw new Error('driver must be a project-contained relative JS/TS module path')
  }
  const driver = await contained(root, resolve(dirname(suitePath), authoredDriver))
  signal.throwIfAborted()
  return { path, entry, driver }
}

function targetId(selector: string): string {
  return createHash('sha256').update(selector).digest('hex')
}

export default {
  apiVersion: 1,
  async resolve(request) {
    checkOptions(request.options)
    const targets: ResolvedTarget[] = []
    const errors: { selector: string; message: string }[] = []
    for (const selector of request.selectors) {
      try {
        const value = await selected(request.projectRoot, selector, request.signal)
        targets.push({ selector, targetId: targetId(selector), displayName: value.entry.scenario.name, source: { path: value.path, line: value.entry.line } })
      } catch (error) {
        request.signal.throwIfAborted()
        errors.push({ selector, message: error instanceof Error ? error.message : String(error) })
      }
    }
    return { targets, errors }
  },
  async run(request) {
    checkOptions(request.options)
    const results: TargetResult[] = []
    const work: WorkItem[] = []
    for (const target of request.targets) {
      try {
        if (target.targetId !== targetId(target.selector)) throw new Error('target identity does not match its selector')
        const value = await selected(request.projectRoot, target.selector, request.signal)
        work.push({ targetId: target.targetId, driver: value.driver, scenario: value.entry.scenario })
      } catch (error) {
        request.signal.throwIfAborted()
        results.push({ targetId: target.targetId, status: 'fail', diagnostic: error instanceof Error ? error.message : String(error) })
      }
    }
    if (work.length) results.push(...await execute(fileURLToPath(new URL('./worker.js', import.meta.url)), work, request.cwd, request.signal))
    return { results }
  },
} satisfies RunnerPlugin
