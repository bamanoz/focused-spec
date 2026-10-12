import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { parse } from 'yaml'
import type { DocumentLayout, FocusedSpecConfig, PluginConfig, RunnerConfig, Violation } from './model.js'
import type { JsonValue } from './runner-api.js'
import { isScopeName } from './sources.js'
import { isPackageSpecifier } from './plugin-module.js'

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
const CONFIG_KEYS: Readonly<Record<string, true>> = { version: true, specifications: true, evidence: true, runners: true, execution: true }
const SPECIFICATION_KEYS: Readonly<Record<string, true>> = { documents: true, formats: true }
const DOCUMENT_KEYS: Readonly<Record<string, true>> = { match: true, scope: true, exclude: true, format: true }
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

export function parseEvidenceConfig(value: unknown, path: string, violations: Violation[]): FocusedSpecConfig['evidence'] {
  if (value === undefined) return undefined
  const evidence = object(value)
  if (evidence === undefined) {
    violations.push({ path, message: 'evidence must be an object containing files' })
    return undefined
  }
  rejectUnknownKeys(evidence, { files: true }, 'evidence', path, violations)
  if (!Array.isArray(evidence.files) || evidence.files.length === 0) {
    violations.push({ path, message: 'evidence.files must be a non-empty array of project-relative YAML paths or patterns' })
    return undefined
  }
  const files: string[] = []
  for (const [index, pattern] of evidence.files.entries()) {
    const context = `evidence.files[${index}]`
    if (!validatePattern(pattern, context, path, violations)) continue
    if (pattern.trim() === '' || /^[A-Za-z]:/u.test(pattern) || /(?:^|[/{,])\.\.(?:[/},]|$)/u.test(pattern)) {
      violations.push({ path, message: `${context} must be a safe non-empty project-relative path pattern` })
      continue
    }
    files.push(pattern)
  }
  return { files }
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
  if (typeof record.format !== 'string' || !RUNNER_ID.test(record.format)) {
    violations.push({ path, message: `${context}.format must name a registered format` })
  }

  const captures = match.split(SCOPE_TOKEN).length - 1
  const malformedCapture = /\{[^}]*scope[^}]*\}/u.exec(match)?.[0]
  if (malformedCapture !== undefined && malformedCapture !== SCOPE_TOKEN) {
    violations.push({ path, message: `${context}.match contains malformed scope capture ${malformedCapture}` })
  }

  if (record.scope !== undefined) {
    if (typeof record.scope !== 'string' || !isScopeName(record.scope)) {
      violations.push({ path, message: `${context}.scope must be a path-safe non-empty scope name` })
    }
    if (captures !== 0) violations.push({ path, message: `${context} fixed-scope match must not contain ${SCOPE_TOKEN}` })
  } else if (captures !== 1) {
    violations.push({ path, message: `${context} captured-scope match must contain exactly one ${SCOPE_TOKEN}` })
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
    format: record.format as string,
    ...(typeof record.scope === 'string' ? { scope: record.scope } : {}),
    ...(exclude === undefined ? {} : { exclude }),
  }
}


function parsePlugin(kind: 'format' | 'runner', id: string, value: unknown, path: string, violations: Violation[]): RunnerConfig | undefined {
  const record = object(value)
  const count = violations.length
  if (!RUNNER_ID.test(id)) violations.push({ path, message: `invalid ${kind} ID ${id}` })
  if (record === undefined) {
    violations.push({ path, message: `${kind} ${id} must define exactly one package or module` })
    return undefined
  }
  rejectUnknownKeys(record, kind === 'runner' ? { package: true, module: true, cwd: true, timeoutMs: true, options: true } : { package: true, module: true, timeoutMs: true, options: true }, `${kind} ${id}`, path, violations)
  if ((record.package === undefined) === (record.module === undefined)) {
    violations.push({ path, message: `${kind} ${id} must define exactly one package or module` })
  } else if (record.package !== undefined) {
    if (typeof record.package !== 'string' || !isPackageSpecifier(record.package)) violations.push({ path, message: `${kind} ${id} package must name an installed package or public subpath` })
  } else if (typeof record.module !== 'string' || record.module.trim() === '') {
    violations.push({ path, message: `${kind} ${id} must define a non-empty module path` })
  }
  if (record.cwd !== undefined && (typeof record.cwd !== 'string' || record.cwd.length === 0)) violations.push({ path, message: `${kind} ${id} cwd must be a non-empty relative path` })
  if (record.timeoutMs !== undefined && (!Number.isInteger(record.timeoutMs) || (record.timeoutMs as number) <= 0 || (record.timeoutMs as number) > MAX_RUNNER_TIMEOUT_MS)) violations.push({ path, message: `${kind} ${id} timeoutMs must be an integer from 1 to ${MAX_RUNNER_TIMEOUT_MS}` })
  if (record.options !== undefined && !isJsonValue(record.options)) violations.push({ path, message: `${kind} ${id} options must be JSON-compatible` })
  if (violations.length !== count) return undefined
  const reference: PluginConfig = typeof record.package === 'string' ? { package: record.package } : { module: record.module as string }
  return { ...reference,
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
  if (root.version !== 4) violations.push({ path, message: 'configuration version must be 4; register installed format adapters and set format on every document layout; migrate obsolete inline ID/EVIDENCE rows to native bindings and the registry; obtain upgrade guidance from the installed CLI: `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`' })

  const specifications = object(root.specifications)
  let specificationConfig: FocusedSpecConfig['specifications'] | undefined
  if (specifications === undefined) {
    violations.push({ path, message: 'specifications must be an object' })
  } else {
    rejectUnknownKeys(specifications, SPECIFICATION_KEYS, 'specifications', path, violations)
    const formatValues = object(specifications.formats)
    if (formatValues === undefined) violations.push({ path, message: 'specifications.formats must be a map of explicitly registered adapters' })
    const formats: Record<string, PluginConfig> = {}
    for (const [id, value] of Object.entries(formatValues ?? {})) {
      const format = parsePlugin('format', id, value, path, violations)
      if (format !== undefined) formats[id] = format
    }
    if (!Array.isArray(specifications.documents) || specifications.documents.length === 0) {
      violations.push({ path, message: 'specifications.documents must be a non-empty array' })
    } else {
      const documents: DocumentLayout[] = []
      for (let index = 0; index < specifications.documents.length; index += 1) {
        const layout = parseDocumentLayout(specifications.documents[index], index, path, violations)
        if (layout !== undefined) {
          documents.push(layout)
          if (!Object.hasOwn(formats, layout.format)) violations.push({ path, message: `document layout selects unknown format ${layout.format}` })
        }
      }
      specificationConfig = { documents, formats }
    }
  }

  const evidence = parseEvidenceConfig(root.evidence, path, violations)

  const runnerValues = object(root.runners)
  if (runnerValues === undefined) violations.push({ path, message: 'runners must be an object' })
  const runners: Record<string, RunnerConfig> = {}
  for (const [id, runner] of Object.entries(runnerValues ?? {})) {
    const parsed = parsePlugin('runner', id, runner, path, violations)
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
    config: { version: 4, specifications: specificationConfig, runners, ...(evidence === undefined ? {} : { evidence }), ...(execution === undefined ? {} : { execution }) },
  }
}
