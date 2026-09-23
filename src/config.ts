import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { parse } from 'yaml'
import type { FocusedSpecConfig, RunnerConfig, Violation } from './model.js'
import type { JsonValue } from './runner-api.js'

const RUNNER_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u
const PARENT_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/u

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  const record = object(value)
  return record !== undefined && Object.values(record).every(isJsonValue)
}


function parseRunner(id: string, value: unknown, path: string, violations: Violation[]): RunnerConfig | undefined {
  const record = object(value)
  if (!RUNNER_ID.test(id)) {
    violations.push({ path, message: `invalid runner ID ${id}` })
    return undefined
  }
  if (record === undefined || typeof record.module !== 'string' || record.module.length === 0) {
    violations.push({ path, message: `runner ${id} must define a non-empty module path` })
    return undefined
  }
  if (record.cwd !== undefined && (typeof record.cwd !== 'string' || record.cwd.length === 0)) {
    violations.push({ path, message: `runner ${id} cwd must be a non-empty relative path` })
    return undefined
  }
  if (record.timeoutMs !== undefined && (!Number.isInteger(record.timeoutMs) || (record.timeoutMs as number) <= 0)) {
    violations.push({ path, message: `runner ${id} timeoutMs must be a positive integer` })
    return undefined
  }
  if (record.options !== undefined && !isJsonValue(record.options)) {
    violations.push({ path, message: `runner ${id} options must be JSON-compatible` })
    return undefined
  }
  return {
    module: record.module,
    ...(record.cwd === undefined ? {} : { cwd: record.cwd as string }),
    ...(record.timeoutMs === undefined ? {} : { timeoutMs: record.timeoutMs as number }),
    ...(record.options === undefined ? {} : { options: record.options as JsonValue }),
  }
}

export async function loadConfig(projectRoot: string, explicitPath?: string): Promise<{
  config?: FocusedSpecConfig
  path: string
  violations: readonly Violation[]
}> {
  const path = explicitPath === undefined
    ? resolve(projectRoot, '.focused-spec/config.yaml')
    : isAbsolute(explicitPath) ? explicitPath : resolve(projectRoot, explicitPath)
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    return { path, violations: [{ path, message: `cannot read configuration: ${error instanceof Error ? error.message : String(error)}` }] }
  }

  let value: unknown
  try {
    value = parse(source)
  } catch (error) {
    return { path, violations: [{ path, message: `invalid YAML: ${error instanceof Error ? error.message : String(error)}` }] }
  }

  const violations: Violation[] = []
  const root = object(value)
  if (root === undefined || root.version !== 1) {
    return { path, violations: [{ path, message: 'configuration version must be 1' }] }
  }

  const specifications = object(root.specifications)
  let specificationConfig: FocusedSpecConfig['specifications'] | undefined
  if (specifications?.source === 'openspec') {
    if (specifications.root !== undefined && (typeof specifications.root !== 'string' || specifications.root.length === 0 || isAbsolute(specifications.root) || PARENT_SEGMENT.test(specifications.root))) {
      violations.push({ path, message: 'specifications.root must be a non-empty relative path' })
    } else {
      specificationConfig = {
        source: 'openspec',
        ...(specifications.root === undefined ? {} : { root: specifications.root as string }),
      }
    }
  } else if (specifications?.source === 'files') {
    if (!Array.isArray(specifications.paths) || specifications.paths.length === 0 || !specifications.paths.every(item => typeof item === 'string' && item.length > 0 && !isAbsolute(item) && !PARENT_SEGMENT.test(item))) {
      violations.push({ path, message: 'file specifications require a non-empty paths string array' })
    } else {
      specificationConfig = { source: 'files', paths: specifications.paths as string[] }
    }
  } else {
    violations.push({ path, message: 'specifications.source must be openspec or files' })
  }

  const runnerValues = object(root.runners)
  if (runnerValues === undefined) violations.push({ path, message: 'runners must be an object' })
  const runners: Record<string, RunnerConfig> = {}
  for (const [id, runner] of Object.entries(runnerValues ?? {})) {
    const parsed = parseRunner(id, runner, path, violations)
    if (parsed !== undefined) runners[id] = parsed
  }

  if (specificationConfig === undefined || violations.length > 0) return { path, violations }
  return {
    path,
    violations,
    config: { version: 1, specifications: specificationConfig, runners },
  }
}
