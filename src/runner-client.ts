import { fork } from 'node:child_process'
import { existsSync } from 'node:fs'
import { access } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RunnerConfig } from './model.js'
import { isJsonValue } from './config.js'
import type { JsonValue, ResolveResponse, ResolvedTarget, RunResponse, TargetResult } from './runner-api.js'
const DEFAULT_TIMEOUT_MS = 120_000
const MODULE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.mts'])
const OUTPUT_LIMIT = 16_384

interface HostResponse {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
}

function inside(root: string, path: string): boolean {
  const value = relative(resolve(root), resolve(path))
  return value === '' || (!value.startsWith(`..${sep}`) && value !== '..' && !isAbsolute(value))
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function boundedAppend(current: string, chunk: unknown): string {
  const next = current + String(chunk)
  return next.length <= OUTPUT_LIMIT ? next : next.slice(next.length - OUTPUT_LIMIT)
}

async function runnerPaths(projectRoot: string, config: RunnerConfig): Promise<{ modulePath: string; cwd: string }> {
  if (isAbsolute(config.module)) throw new Error('runner module must be project-relative')
  const modulePath = resolve(projectRoot, config.module)
  if (!inside(projectRoot, modulePath)) throw new Error('runner module must stay inside project root')
  if (!MODULE_EXTENSIONS.has(extname(modulePath))) throw new Error('runner module must be .ts, .mts, .js, or .mjs')
  await access(modulePath)

  if (config.cwd !== undefined && isAbsolute(config.cwd)) throw new Error('runner cwd must be project-relative')
  const cwd = resolve(projectRoot, config.cwd ?? '.')
  if (!inside(projectRoot, cwd)) throw new Error('runner cwd must stay inside project root')
  await access(cwd)
  return { modulePath, cwd }
}

async function invokeHost(projectRoot: string, runnerId: string, config: RunnerConfig, payload: Readonly<Record<string, unknown>>): Promise<unknown> {
  const { modulePath, cwd } = await runnerPaths(projectRoot, config)
  const compiledHost = fileURLToPath(new URL('./runner-host.js', import.meta.url))
  const sourceHost = fileURLToPath(new URL('./runner-host.ts', import.meta.url))
  const hostPath = existsSync(compiledHost) ? compiledHost : sourceHost
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const child = fork(hostPath, [], {
    cwd: projectRoot,
    execArgv: (extname(modulePath) === '.ts' || extname(modulePath) === '.mts') && !process.features.typescript
      ? ['--experimental-strip-types']
      : [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  const { promise, resolve: resolvePromise, reject: rejectPromise } = Promise.withResolvers<unknown>()
  let settled = false
  let output = ''
  child.stdout?.on('data', chunk => { output = boundedAppend(output, chunk) })
  child.stderr?.on('data', chunk => { output = boundedAppend(output, chunk) })

  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    child.kill('SIGKILL')
    rejectPromise(new Error(`runner ${runnerId} timed out after ${timeoutMs}ms${output === '' ? '' : `\n${output}`}`))
  }, timeoutMs + 1_000)

  child.once('message', message => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    child.kill()
    const response = message as HostResponse
    if (!response.ok) {
      rejectPromise(new Error(`runner ${runnerId} failed: ${response.error ?? 'unknown error'}${output === '' ? '' : `\n${output}`}`))
      return
    }
    resolvePromise(response.value)
  })
  child.once('error', error => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    rejectPromise(error)
  })
  child.once('exit', code => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    rejectPromise(new Error(`runner ${runnerId} exited before responding with code ${String(code)}${output === '' ? '' : `\n${output}`}`))
  })
  child.send({
    ...payload,
    modulePath,
    projectRoot,
    cwd,
    runnerId,
    options: config.options ?? null,
    timeoutMs,
  })
  return promise
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function validateTarget(projectRoot: string, value: unknown): ResolvedTarget {
  const target = record(value)
  if (target === undefined || !text(target.selector) || !text(target.targetId) || !text(target.displayName)) {
    throw new Error('runner returned an invalid resolved target')
  }
  let source: ResolvedTarget['source']
  if (target.source !== undefined) {
    const location = record(target.source)
    if (location === undefined || !text(location.path) || isAbsolute(location.path)) throw new Error('runner returned an invalid source path')
    const absolute = resolve(projectRoot, location.path)
    if (!inside(projectRoot, absolute)) throw new Error('runner source path must stay inside project root')
    if (location.line !== undefined && (!Number.isInteger(location.line) || (location.line as number) <= 0)) {
      throw new Error('runner source line must be a positive integer')
    }
    source = { path: location.path, ...(location.line === undefined ? {} : { line: location.line as number }) }
  }
  if (target.data !== undefined && !isJsonValue(target.data)) throw new Error('runner target data must be JSON-compatible')
  return {
    selector: target.selector,
    targetId: target.targetId,
    displayName: target.displayName,
    ...(source === undefined ? {} : { source }),
    ...(target.data === undefined ? {} : { data: target.data as JsonValue }),
  }
}

export async function resolveRunnerTargets(
  projectRoot: string,
  runnerId: string,
  config: RunnerConfig,
  selectors: readonly string[],
): Promise<ResolveResponse> {
  const value = record(await invokeHost(projectRoot, runnerId, config, { operation: 'resolve', selectors }))
  if (value === undefined || !Array.isArray(value.targets) || !Array.isArray(value.errors)) {
    throw new Error(`runner ${runnerId} returned an invalid resolve response`)
  }
  const targets = value.targets.map(item => validateTarget(projectRoot, item))
  const errors = value.errors.map(item => {
    const error = record(item)
    if (error === undefined || !text(error.selector) || !text(error.message)) throw new Error(`runner ${runnerId} returned an invalid resolve error`)
    return { selector: error.selector, message: error.message }
  })
  const requested = new Set(selectors)
  const outcomes = new Map<string, number>()
  for (const target of targets) {
    if (!requested.has(target.selector)) throw new Error(`runner ${runnerId} returned unknown selector ${target.selector}`)
    outcomes.set(target.selector, (outcomes.get(target.selector) ?? 0) + 1)
  }
  for (const error of errors) {
    if (!requested.has(error.selector)) throw new Error(`runner ${runnerId} returned unknown selector ${error.selector}`)
    outcomes.set(error.selector, (outcomes.get(error.selector) ?? 0) + 1)
  }
  for (const selector of selectors) {
    const count = outcomes.get(selector) ?? 0
    if (count !== 1) throw new Error(`runner ${runnerId} must return exactly one resolution outcome for ${selector}; received ${count}`)
  }
  return { targets, errors }
}

export async function runRunnerTargets(
  projectRoot: string,
  runnerId: string,
  config: RunnerConfig,
  targets: readonly ResolvedTarget[],
): Promise<RunResponse> {
  const value = record(await invokeHost(projectRoot, runnerId, config, { operation: 'run', targets }))
  if (value === undefined || !Array.isArray(value.results)) throw new Error(`runner ${runnerId} returned an invalid run response`)
  const requested = new Set(targets.map(target => target.targetId))
  const seen = new Set<string>()
  const results: TargetResult[] = value.results.map(item => {
    const result = record(item)
    if (result === undefined || !text(result.targetId) || (result.status !== 'pass' && result.status !== 'fail' && result.status !== 'skip')) {
      throw new Error(`runner ${runnerId} returned an invalid target result`)
    }
    if (!requested.has(result.targetId)) throw new Error(`runner ${runnerId} returned unknown target ${result.targetId}`)
    if (seen.has(result.targetId)) throw new Error(`runner ${runnerId} returned duplicate target ${result.targetId}`)
    if (result.diagnostic !== undefined && typeof result.diagnostic !== 'string') throw new Error(`runner ${runnerId} returned an invalid diagnostic`)
    seen.add(result.targetId)
    return {
      targetId: result.targetId,
      status: result.status as TargetResult['status'],
      ...(result.diagnostic === undefined ? {} : { diagnostic: result.diagnostic }),
    }
  })
  for (const target of targets) {
    if (!seen.has(target.targetId)) throw new Error(`runner ${runnerId} did not return target ${target.targetId}`)
  }
  return { results }
}
