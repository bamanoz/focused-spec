import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { parse } from 'yaml'
import type { DocumentLayout, FocusedSpecConfig, RunnerConfig, Violation } from './model.js'
import type { JsonValue } from './runner-api.js'

const RUNNER_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u
const PARENT_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/u
// The host timer adds a one-second grace period; Node timers cannot exceed 2^31 - 1 ms.
const MAX_RUNNER_TIMEOUT_MS = 2_147_483_647 - 1_000

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
const CONFIG_KEYS: Readonly<Record<string, true>> = { version: true, specifications: true, runners: true, execution: true }
const SPECIFICATION_KEYS: Readonly<Record<string, true>> = { documents: true }
const DOCUMENT_KEYS: Readonly<Record<string, true>> = { match: true, scope: true, exclude: true }
const EXECUTION_KEYS: Readonly<Record<string, true>> = { maxConcurrentGroups: true }
const SCOPE_TOKEN = '{scope}'
const CAPTURE_GLOB = /[*?\[\]{}()!+@]/u

function rejectUnknownKeys(
  record: Readonly<Record<string, unknown>>,
  allowed: Readonly<Record<string, true>>,
  context: string,
  path: string,
  violations: Violation[],
): void {
  for (const key of Object.keys(record)) {
    if (allowed[key] !== true) violations.push({ path, message: `unknown ${context} key ${key}` })
  }
}

function validatePattern(value: unknown, context: string, path: string, violations: Violation[]): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    violations.push({ path, message: `${context} must be a non-empty project-relative path pattern` })
    return false
  }
  if (isAbsolute(value) || value.startsWith('!') || value.includes('\\') || value.includes('\0') || PARENT_SEGMENT.test(value)) {
    violations.push({ path, message: `${context} must be a safe project-relative path pattern` })
    return false
  }
  return true
}


function parseDocumentLayout(value: unknown, index: number, path: string, violations: Violation[]): DocumentLayout | undefined {
  const violationCount = violations.length
  const context = `specifications.documents[${index}]`
  const record = object(value)
  if (record === undefined) {
    violations.push({ path, message: `${context} must be an object` })
    return undefined
  }
  rejectUnknownKeys(record, DOCUMENT_KEYS, context, path, violations)

  if (!validatePattern(record.match, `${context}.match`, path, violations)) return undefined
  const match = record.match
  if (!/\.md$/iu.test(match)) {
    violations.push({ path, message: `${context}.match must select Markdown documents ending in .md` })
  }

  const captures = match.split(SCOPE_TOKEN).length - 1
  const malformedCapture = /\{[^}]*scope[^}]*\}/u.exec(match)?.[0]
  if (malformedCapture !== undefined && malformedCapture !== SCOPE_TOKEN) {
    violations.push({ path, message: `${context}.match contains malformed scope capture ${malformedCapture}` })
  }

  if (record.scope === 'baseline') {
    if (captures !== 0) violations.push({ path, message: `${context} baseline match must not contain ${SCOPE_TOKEN}` })
  } else if (record.scope !== undefined) {
    violations.push({ path, message: `${context}.scope must be baseline when present` })
  } else if (captures !== 1) {
    violations.push({ path, message: `${context} named-scope match must contain exactly one ${SCOPE_TOKEN}` })
  }

  if (captures > 0) {
    const matchSegments = match.split('/')
    const captureIndex = matchSegments.findIndex(segment => segment.includes(SCOPE_TOKEN))
    const captureSegment = matchSegments[captureIndex]
    if (captureSegment === undefined || CAPTURE_GLOB.test(captureSegment.replace(SCOPE_TOKEN, ''))) {
      violations.push({ path, message: `${context}.match scope capture must be in one segment with only a fixed prefix or suffix` })
    } else if (matchSegments.slice(0, captureIndex).includes('**') && matchSegments.slice(captureIndex + 1).includes('**')) {
      violations.push({ path, message: `${context}.match scope capture is ambiguous between globstars` })
    }
  }

  let exclude: readonly string[] | undefined
  if (record.exclude !== undefined) {
    if (!Array.isArray(record.exclude)) {
      violations.push({ path, message: `${context}.exclude must be an array of project-relative path patterns` })
    } else {
      const parsed: string[] = []
      for (let excludeIndex = 0; excludeIndex < record.exclude.length; excludeIndex += 1) {
        const candidate = record.exclude[excludeIndex]
        if (!validatePattern(candidate, `${context}.exclude[${excludeIndex}]`, path, violations)) continue
        if (candidate.includes(SCOPE_TOKEN)) {
          violations.push({ path, message: `${context}.exclude[${excludeIndex}] must not contain ${SCOPE_TOKEN}` })
          continue
        }
        parsed.push(candidate)
      }
      exclude = parsed
    }
  }

  if (violations.length !== violationCount) return undefined
  return {
    match,
    ...(record.scope === 'baseline' ? { scope: 'baseline' as const } : {}),
    ...(exclude === undefined ? {} : { exclude }),
  }
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
  if (record.timeoutMs !== undefined && (!Number.isInteger(record.timeoutMs) || (record.timeoutMs as number) <= 0 || (record.timeoutMs as number) > MAX_RUNNER_TIMEOUT_MS)) {
    violations.push({ path, message: `runner ${id} timeoutMs must be an integer from 1 to ${MAX_RUNNER_TIMEOUT_MS}` })
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
  if (root === undefined) {
    return { path, violations: [{ path, message: 'configuration must be an object' }] }
  }
  rejectUnknownKeys(root, CONFIG_KEYS, 'configuration', path, violations)
  if (root.version !== 2) violations.push({ path, message: 'configuration version must be 2' })

  const specifications = object(root.specifications)
  let specificationConfig: FocusedSpecConfig['specifications'] | undefined
  if (specifications === undefined) {
    violations.push({ path, message: 'specifications must be an object' })
  } else {
    rejectUnknownKeys(specifications, SPECIFICATION_KEYS, 'specifications', path, violations)
    if (!Array.isArray(specifications.documents) || specifications.documents.length === 0) {
      violations.push({ path, message: 'specifications.documents must be a non-empty array' })
    } else {
      const documents: DocumentLayout[] = []
      for (let index = 0; index < specifications.documents.length; index += 1) {
        const layout = parseDocumentLayout(specifications.documents[index], index, path, violations)
        if (layout !== undefined) documents.push(layout)
      }
      specificationConfig = { documents }
    }
  }

  const runnerValues = object(root.runners)
  if (runnerValues === undefined) violations.push({ path, message: 'runners must be an object' })
  const runners: Record<string, RunnerConfig> = {}
  for (const [id, runner] of Object.entries(runnerValues ?? {})) {
    const parsed = parseRunner(id, runner, path, violations)
    if (parsed !== undefined) runners[id] = parsed
  }

  const executionValue = object(root.execution)
  let execution: FocusedSpecConfig['execution'] | undefined
  if (root.execution !== undefined && executionValue === undefined) {
    violations.push({ path, message: 'execution must be an object' })
  } else if (executionValue !== undefined) {
    rejectUnknownKeys(executionValue, EXECUTION_KEYS, 'execution', path, violations)
    if (executionValue.maxConcurrentGroups !== undefined && (!Number.isInteger(executionValue.maxConcurrentGroups) || (executionValue.maxConcurrentGroups as number) <= 0)) {
      violations.push({ path, message: 'execution.maxConcurrentGroups must be a positive integer' })
    } else {
      execution = executionValue.maxConcurrentGroups === undefined
        ? {}
        : { maxConcurrentGroups: executionValue.maxConcurrentGroups as number }
    }
  }

  if (specificationConfig === undefined || violations.length > 0) return { path, violations }
  return {
    path,
    violations,
    config: { version: 2, specifications: specificationConfig, runners, ...(execution === undefined ? {} : { execution }) },
  }
}
