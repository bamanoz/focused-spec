#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const usageKeys = ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const
const nativeAspects = ['authoring', 'evidence', 'nativeValidation', 'nativeLifecycle'] as const

type UsageKey = typeof usageKeys[number]
type NativeAspect = typeof nativeAspects[number]
type ResultKind = 'public' | 'native'
type GuidanceOutcome = 'passed' | 'failed' | 'blocked' | 'unobserved' | 'interrupted'

interface Gate {
  readonly name: string
  readonly passed: boolean | null
  readonly detail: string
  readonly blockedBy?: string
}

interface Measurement {
  readonly durationMs: number
  readonly usage: Readonly<Record<UsageKey, number>> | null
  readonly usageComplete: boolean
}

interface ParsedResult {
  readonly kind: ResultKind
  readonly caseId: string
  readonly mode: string
  readonly model: string | null
  readonly taskPassed: boolean
  readonly certified: boolean | null
  readonly aspects: Readonly<Partial<Record<NativeAspect, { readonly status: 'passed' | 'failed' | 'unverified'; readonly detail: string }>>>
  readonly gates: readonly Gate[]
  readonly observations: readonly Gate[]
  readonly publicTurns: number
  readonly measurement: Measurement | null
  readonly phaseMeasurements: Readonly<Partial<Record<'authoring' | 'lifecycle', Measurement>>>
}

interface Identity {
  readonly value: string | null
  readonly source: 'result' | 'attempt' | 'entry' | 'manifest' | 'candidate-assets' | 'unknown'
}

export interface ReportSource {
  readonly path: string
  readonly sha256: string
  readonly role: 'manifest' | 'result'
  readonly references: readonly string[]
}

export interface ReportInvocation {
  readonly id: string
  readonly kind: ResultKind | 'unknown'
  readonly caseId: string
  readonly mode: string
  readonly attempt: number | null
  readonly resultPaths: readonly string[]
  readonly recordedResultPaths: readonly string[]
  readonly missingResult: boolean
  readonly exitCode: number | null
  readonly signal: string | null
  readonly status: string
  readonly model: Identity
  readonly candidate: Identity
  readonly providerStatuses: readonly (number | string)[]
  readonly providerInterrupted: boolean
  readonly provisioningInterrupted: boolean
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface ReportResult {
  readonly path: string
  readonly sha256: string
  readonly kind: ResultKind
  readonly caseId: string
  readonly mode: string
  model: Identity
  candidate: Identity
  readonly taskPassed: boolean
  readonly certified: boolean | null
  readonly nativeAspects: Readonly<Partial<Record<NativeAspect, { readonly status: 'passed' | 'failed' | 'unverified'; readonly detail: string }>>>
  readonly failedGates: readonly Gate[]
  readonly blockedGates: readonly Gate[]
  readonly observations: readonly Gate[]
  readonly measurements: {
    readonly total: Measurement | null
    readonly phases: Readonly<Partial<Record<'authoring' | 'lifecycle', Measurement>>>
  }
}

interface CountedRate {
  readonly eligible: number
  readonly observed: number
  readonly passed: number
  readonly failed: number
  readonly blocked: number
  readonly unobserved: number
  readonly interrupted: number
  readonly failureRate: number | null
}

interface GuidanceJudgment {
  readonly resultPath: string | null
  readonly invocationId: string | null
  readonly kind: ResultKind | 'unknown'
  readonly caseId: string
  readonly mode: string
  readonly granularity: 'public-turn' | 'native-combined' | 'invocation'
  readonly dimension: 'loader' | 'workflow' | 'hostGuidance'
  readonly outcome: GuidanceOutcome
  readonly gateName: string | null
  readonly detail: string
  readonly blockedBy: string | null
}

interface GateReference extends Gate {
  readonly resultPath: string
  readonly kind: ResultKind
  readonly caseId: string
  readonly mode: string
}

interface ObservationReference extends GateReference {
  readonly outcome: 'passed' | 'failed' | 'blocked'
}

interface GroupSummary {
  readonly key: string
  readonly attempts: number
  readonly results: number
  readonly missingResults: number
  readonly publicPassed: number
  readonly publicFailed: number
  readonly nativeCertified: number
  readonly nativeNotCertified: number
  readonly providerInterrupted: number
  readonly provisioningInterrupted: number
}

export interface EvalReport {
  readonly schemaVersion: 1
  readonly repositoryRoot: string
  readonly sources: readonly ReportSource[]
  readonly duplicates: readonly { readonly path: string; readonly firstReference: string; readonly duplicateReference: string }[]
  readonly coverage: {
    readonly attempts: number
    readonly results: number
    readonly missingResults: number
    readonly uniqueCaseModes: number
    readonly attemptedCaseModes: number
    readonly expectedCaseModes: number | null
    readonly pendingCaseModes: number | null
  }
  readonly invocations: readonly ReportInvocation[]
  readonly results: readonly ReportResult[]
  readonly verdicts: {
    readonly public: { readonly passed: number; readonly failed: number }
    readonly native: { readonly certified: number; readonly notCertified: number }
    readonly nativeAspects: Readonly<Record<NativeAspect, { readonly passed: number; readonly failed: number; readonly unverified: number; readonly missing: number }>>
    readonly failedGates: readonly GateReference[]
    readonly blockedGates: readonly GateReference[]
  }
  readonly interruptions: {
    readonly provider: number
    readonly provisioning: number
    readonly missingResult: number
  }
  readonly measurements: {
    readonly eligibleResults: number
    readonly measuredResults: number
    readonly missingResults: number
    readonly usageMeasuredResults: number
    readonly completeUsageResults: number
    readonly incompleteUsageResults: number
    readonly durationMs: number
    readonly usage: Readonly<Record<UsageKey, number>>
    readonly completeCaseDurationMs: number
    readonly completeCaseUsage: Readonly<Record<UsageKey, number>>
    readonly nativePhaseCoverage: {
      readonly authoring: number
      readonly lifecycle: number
    }
    readonly timingBoundary: {
      readonly public: string
      readonly native: string
      readonly excluded: readonly string[]
    }
  }
  readonly guidance: {
    readonly loader: { readonly totals: CountedRate; readonly publicTurns: CountedRate; readonly nativeCombined: CountedRate }
    readonly workflow: { readonly totals: CountedRate; readonly publicTurns: CountedRate; readonly nativeCombined: CountedRate }
    readonly hostGuidance: { readonly totals: CountedRate; readonly publicTurns: CountedRate; readonly nativeCombined: CountedRate }
    readonly judgments: readonly GuidanceJudgment[]
  }
  readonly integrationObservations: {
    readonly passed: number
    readonly failed: number
    readonly blocked: number
    readonly records: readonly ObservationReference[]
  }
  readonly groups: {
    readonly byCaseMode: readonly GroupSummary[]
    readonly byModelCandidate: readonly GroupSummary[]
  }
}

interface LoadedJson {
  readonly path: string
  readonly bytes: string
  readonly sha256: string
  readonly value: unknown
}

interface ResultState {
  readonly parsed: ParsedResult
  readonly report: ReportResult
  readonly references: string[]
  providerInterrupted: boolean
  invocationInterrupted: boolean
}

interface BuildOptions {
  readonly results: readonly string[]
  readonly manifests: readonly string[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a nonempty string`)
  return value
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  return text(value, label)
}

function nonnegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite nonnegative number`)
  return value
}

function sha256(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

async function loadJson(path: string, label: string): Promise<LoadedJson> {
  const absolute = resolve(path)
  let bytes: string
  try {
    bytes = await readFile(absolute, 'utf8')
  } catch (error) {
    throw new Error(`cannot read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  let value: unknown
  try {
    value = JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(`malformed JSON in ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { path: await realpath(absolute), bytes, sha256: sha256(bytes), value }
}

function parseGate(value: unknown, label: string): Gate {
  if (!isObject(value)) throw new Error(`${label} must be an object`)
  const name = text(value.name, `${label}.name`)
  if (value.passed !== true && value.passed !== false && value.passed !== null) throw new Error(`${label}.passed must be true, false, or null`)
  const detail = text(value.detail, `${label}.detail`)
  const blockedBy = optionalText(value.blockedBy, `${label}.blockedBy`)
  return { name, passed: value.passed, detail, ...(blockedBy === null ? {} : { blockedBy }) }
}

function parseGates(value: unknown, label: string, optional = false): Gate[] {
  if (value === undefined && optional) return []
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((gate, index) => parseGate(gate, `${label}[${index}]`))
}

function parseMeasurement(value: unknown, label: string): Measurement {
  if (!isObject(value)) throw new Error(`${label} must be an object`)
  const durationMs = nonnegative(value.durationMs, `${label}.durationMs`)
  if (typeof value.usageComplete !== 'boolean') throw new Error(`${label}.usageComplete must be boolean`)
  let usage: Readonly<Record<UsageKey, number>> | null = null
  if (value.usage !== null) {
    if (!isObject(value.usage)) throw new Error(`${label}.usage must be an object or null`)
    const parsed: Record<UsageKey, number> = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }
    for (const key of usageKeys) parsed[key] = nonnegative(value.usage[key], `${label}.usage.${key}`)
    usage = parsed
  }
  return { durationMs, usage, usageComplete: value.usageComplete }
}

function parseMeasurements(value: Record<string, unknown>, label: string): {
  readonly measurement: Measurement | null
  readonly phases: Readonly<Partial<Record<'authoring' | 'lifecycle', Measurement>>>
} {
  const measurement = value.measurements === undefined ? null : parseMeasurement(value.measurements, `${label}.measurements`)
  const phases: Partial<Record<'authoring' | 'lifecycle', Measurement>> = {}
  if (value.phaseMeasurements !== undefined) {
    if (!isObject(value.phaseMeasurements)) throw new Error(`${label}.phaseMeasurements must be an object`)
    for (const phase of ['authoring', 'lifecycle'] as const) {
      const phaseValue = value.phaseMeasurements[phase]
      if (phaseValue !== undefined) phases[phase] = parseMeasurement(phaseValue, `${label}.phaseMeasurements.${phase}`)
    }
  }
  return { measurement, phases }
}

function parseOutcome(value: unknown, label: string): { readonly status: 'passed' | 'failed' | 'unverified'; readonly detail: string } {
  if (!isObject(value) || (value.status !== 'passed' && value.status !== 'failed' && value.status !== 'unverified')) {
    throw new Error(`${label}.status must be passed, failed, or unverified`)
  }
  return { status: value.status, detail: text(value.detail, `${label}.detail`) }
}
function parseResult(value: unknown, label: string): ParsedResult {
  if (!isObject(value)) throw new Error(`${label} must contain a JSON object`)
  if (typeof value.certified !== 'boolean' && typeof value.passed !== 'boolean') {
    throw new Error(`${label} has an unsupported evaluation result shape`)
  }
  const caseId = text(value.caseId, `${label}.caseId`)
  const gates = parseGates(value.gates, `${label}.gates`)
  const observations = parseGates(value.observations, `${label}.observations`, true)
  const model = optionalText(value.model, `${label}.model`)
  const measurements = parseMeasurements(value, label)
  if (typeof value.certified === 'boolean') {
    const mode = text(value.mode, `${label}.mode`)
    const aspects: Partial<Record<NativeAspect, { readonly status: 'passed' | 'failed' | 'unverified'; readonly detail: string }>> = {}
    for (const aspect of nativeAspects) aspects[aspect] = parseOutcome(value[aspect], `${label}.${aspect}`)
    return {
      kind: 'native', caseId, mode, model, taskPassed: value.certified, certified: value.certified,
      aspects, gates, observations, publicTurns: 0, measurement: measurements.measurement, phaseMeasurements: measurements.phases,
    }
  }
  if (typeof value.passed !== 'boolean') throw new Error(`${label} has an unsupported evaluation result shape`)
  if (!Array.isArray(value.turns)) throw new Error(`${label}.turns must be an array`)
  return {
    kind: 'public', caseId, mode: 'workflow', model, taskPassed: value.passed, certified: null,
    aspects: {}, gates, observations, publicTurns: value.turns.length,
    measurement: measurements.measurement, phaseMeasurements: measurements.phases,
  }
}

function candidateIdentity(attempt: unknown, entry: unknown, manifest: unknown): Identity {
  for (const [value, source] of [[attempt, 'attempt'], [entry, 'entry'], [manifest, 'manifest']] as const) {
    if (!isObject(value)) continue
    for (const field of ['candidateHash', 'candidate', 'candidateId'] as const) {
      const candidate = value[field]
      if (typeof candidate === 'string' && candidate.length > 0) return { value: candidate, source }
    }
    const assets = value.candidateAssets
    if (isObject(assets) && Object.keys(assets).length > 0 && Object.values(assets).every(item => typeof item === 'string' && item.length > 0)) {
      return { value: `assets-sha256:${sha256(stableJson(assets))}`, source: 'candidate-assets' }
    }
  }
  return { value: null, source: 'unknown' }
}

function modelIdentity(result: ParsedResult | null, attempt: unknown, entry: unknown, manifest: unknown): Identity {
  if (result?.model !== null && result?.model !== undefined) return { value: result.model, source: 'result' }
  for (const [value, source] of [[attempt, 'attempt'], [entry, 'entry'], [manifest, 'manifest']] as const) {
    if (isObject(value) && typeof value.model === 'string' && value.model.length > 0) return { value: value.model, source }
  }
  return { value: null, source: 'unknown' }
}

function resolveRecordedPath(path: string): string {
  return isAbsolute(path) ? path : resolve(repositoryRoot, path)
}

function resultReferences(attempt: Record<string, unknown>, label: string): string[] {
  const references: string[] = []
  for (const field of ['resultPath', 'artifact', 'result'] as const) {
    const value = attempt[field]
    if (value !== undefined && value !== null) references.push(text(value, `${label}.${field}`))
  }
  for (const field of ['artifacts', 'resultPaths'] as const) {
    const value = attempt[field]
    if (value === undefined || value === null) continue
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.length > 0)) throw new Error(`${label}.${field} must be an array of nonempty strings`)
    references.push(...value)
  }
  return [...new Set(references)]
}

function explicitStatuses(attempt: Record<string, unknown>, label: string): (number | string)[] {
  const values: (number | string)[] = []
  for (const field of ['providerStatuses', 'providerErrorStatuses'] as const) {
    const value = attempt[field]
    if (value === undefined || value === null) continue
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string' || typeof item === 'number' && Number.isFinite(item))) {
      throw new Error(`${label}.${field} must be an array of strings or numbers`)
    }
    values.push(...value)
  }
  const single = attempt.providerStatus
  if (single !== undefined && single !== null) {
    if (typeof single !== 'string' && (typeof single !== 'number' || !Number.isFinite(single))) throw new Error(`${label}.providerStatus must be a string or number`)
    values.push(single)
  }
  return [...new Set(values)]
}
function interruptionStatus(value: number | string): boolean {
  if (typeof value === 'number') return value >= 400
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric >= 400 : /rate.?limit|error|interrupt|insufficient|unavailable|timeout/iu.test(value)
}

function invocationStatus(attempt: Record<string, unknown>, missingResult: boolean, providerInterrupted: boolean, provisioningInterrupted: boolean): string {
  if (typeof attempt.status === 'string' && attempt.status.length > 0) return attempt.status
  if (providerInterrupted) return 'provider-interrupted'
  if (provisioningInterrupted) return 'provisioning-interrupted'
  if (attempt.passed === true) return 'passed'
  if (attempt.passed === false) return 'failed'
  if (missingResult) return 'missing-result'
  return 'unknown'
}

function zeroUsage(): Record<UsageKey, number> {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }
}

function addUsage(total: Record<UsageKey, number>, usage: Readonly<Record<UsageKey, number>>): void {
  for (const key of usageKeys) total[key] += usage[key]
}

function sumPhases(phases: Readonly<Partial<Record<'authoring' | 'lifecycle', Measurement>>>): Measurement | null {
  const values = Object.values(phases)
  if (values.length === 0) return null
  const usage = zeroUsage()
  let sawUsage = false
  let usageComplete = true
  let durationMs = 0
  for (const value of values) {
    durationMs += value.durationMs
    if (value.usage === null) usageComplete = false
    else { addUsage(usage, value.usage); sawUsage = true }
    if (!value.usageComplete) usageComplete = false
  }
  return { durationMs, usage: sawUsage ? usage : null, usageComplete: sawUsage && usageComplete }
}

function rate(judgments: readonly GuidanceJudgment[], granularity?: GuidanceJudgment['granularity']): CountedRate {
  const selected = granularity === undefined ? judgments : judgments.filter(item => item.granularity === granularity)
  const passed = selected.filter(item => item.outcome === 'passed').length
  const failed = selected.filter(item => item.outcome === 'failed').length
  const blocked = selected.filter(item => item.outcome === 'blocked').length
  const unobserved = selected.filter(item => item.outcome === 'unobserved').length
  const interrupted = selected.filter(item => item.outcome === 'interrupted').length
  const observed = passed + failed
  return { eligible: selected.length, observed, passed, failed, blocked, unobserved, interrupted, failureRate: observed === 0 ? null : failed / observed }
}

function groupSummaries(invocations: readonly ReportInvocation[], results: readonly ReportResult[], selector: (invocation: ReportInvocation) => string): GroupSummary[] {
  const groups = new Map<string, ReportInvocation[]>()
  for (const invocation of invocations) {
    const key = selector(invocation)
    const current = groups.get(key) ?? []
    current.push(invocation)
    groups.set(key, current)
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, attempts]) => {
    const resultPaths = new Set(attempts.flatMap(item => item.resultPaths))
    const selected = results.filter(result => resultPaths.has(result.path))
    return {
      key,
      attempts: attempts.length,
      results: selected.length,
      missingResults: attempts.filter(item => item.missingResult).length,
      publicPassed: selected.filter(item => item.kind === 'public' && item.taskPassed).length,
      publicFailed: selected.filter(item => item.kind === 'public' && !item.taskPassed).length,
      nativeCertified: selected.filter(item => item.kind === 'native' && item.certified === true).length,
      nativeNotCertified: selected.filter(item => item.kind === 'native' && item.certified === false).length,
      providerInterrupted: attempts.filter(item => item.providerInterrupted).length,
      provisioningInterrupted: attempts.filter(item => item.provisioningInterrupted).length,
    }
  })
}

export async function buildEvalReport(options: BuildOptions): Promise<EvalReport> {
  if (options.results.length === 0 && options.manifests.length === 0) throw new Error('at least one --result or --manifest is required')

  const sourceStates = new Map<string, { path: string; sha256: string; role: 'manifest' | 'result'; references: string[] }>()
  const resultStates = new Map<string, ResultState>()
  const duplicates: { path: string; firstReference: string; duplicateReference: string }[] = []
  const invocations: ReportInvocation[] = []
  let expectedCaseModes: number | null = null
  let expectedCoverageAvailable = true

  const addSource = (loaded: LoadedJson, role: 'manifest' | 'result', reference: string): void => {
    const existing = sourceStates.get(loaded.path)
    if (existing === undefined) sourceStates.set(loaded.path, { path: loaded.path, sha256: loaded.sha256, role, references: [reference] })
    else if (!existing.references.includes(reference)) existing.references.push(reference)
  }

  const loadResult = async (path: string, reference: string, missingAllowed: boolean): Promise<ResultState | null> => {
    const absolute = resolveRecordedPath(path)
    let loaded: LoadedJson
    try {
      loaded = await loadJson(absolute, 'result')
    } catch (error) {
      const code = (error as { cause?: { code?: unknown } }).cause?.code
      if (missingAllowed && (code === 'ENOENT' || String(error).includes('ENOENT'))) return null
      if (missingAllowed && String(error).includes('cannot read result') && String(error).includes('no such file')) return null
      throw error
    }
    const existing = resultStates.get(loaded.path)
    if (existing !== undefined) {
      duplicates.push({ path: loaded.path, firstReference: existing.references[0]!, duplicateReference: reference })
      existing.references.push(reference)
      addSource(loaded, 'result', reference)
      return existing
    }
    const parsed = parseResult(loaded.value, `result ${path}`)
    const report: ReportResult = {
      path: loaded.path,
      sha256: loaded.sha256,
      kind: parsed.kind,
      caseId: parsed.caseId,
      mode: parsed.mode,
      model: modelIdentity(parsed, null, null, null),
      candidate: { value: null, source: 'unknown' },
      taskPassed: parsed.taskPassed,
      certified: parsed.certified,
      nativeAspects: parsed.aspects,
      failedGates: parsed.gates.filter(gate => gate.passed === false),
      blockedGates: parsed.gates.filter(gate => gate.passed === null),
      observations: parsed.observations,
      measurements: { total: parsed.measurement, phases: parsed.phaseMeasurements },
    }
    const state: ResultState = { parsed, report, references: [reference], providerInterrupted: false, invocationInterrupted: false }
    resultStates.set(loaded.path, state)
    addSource(loaded, 'result', reference)
    return state
  }

  for (let manifestIndex = 0; manifestIndex < options.manifests.length; manifestIndex += 1) {
    const requested = options.manifests[manifestIndex]!
    const loaded = await loadJson(requested, 'manifest')
    addSource(loaded, 'manifest', `--manifest[${manifestIndex}]`)
    if (!isObject(loaded.value) || !Array.isArray(loaded.value.entries)) throw new Error(`manifest ${requested} must contain entries[].attempts[]`)
    const manifest = loaded.value
    const entries = loaded.value.entries
    const expected = manifest.expected
    if (expected !== undefined) {
      if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) throw new Error(`manifest ${requested}.expected must be a nonnegative integer`)
      expectedCaseModes = (expectedCaseModes ?? 0) + expected
    } else expectedCoverageAvailable = false
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const entryValue = entries[entryIndex]
      if (!isObject(entryValue)) throw new Error(`manifest ${requested}.entries[${entryIndex}] must be an object`)
      const entry = entryValue
      const caseId = text(entry.id ?? entry.caseId, `manifest ${requested}.entries[${entryIndex}].id`)
      const mode = typeof entry.mode === 'string' && entry.mode.length > 0 ? entry.mode : 'workflow'
      const kind: ResultKind | 'unknown' = entry.kind === 'public' || entry.kind === 'native' ? entry.kind : 'unknown'
      if (!Array.isArray(entry.attempts)) throw new Error(`manifest ${requested}.entries[${entryIndex}].attempts must be an array`)
      for (let attemptIndex = 0; attemptIndex < entry.attempts.length; attemptIndex += 1) {
        const attemptValue = entry.attempts[attemptIndex]
        if (!isObject(attemptValue)) throw new Error(`manifest ${requested}.entries[${entryIndex}].attempts[${attemptIndex}] must be an object`)
        const attempt = attemptValue
        const label = `manifest ${requested}.entries[${entryIndex}].attempts[${attemptIndex}]`
        const paths = resultReferences(attempt, label)
        const states: ResultState[] = []
        const resolvedPaths: string[] = []
        for (let referenceIndex = 0; referenceIndex < paths.length; referenceIndex += 1) {
          const state = await loadResult(paths[referenceIndex]!, `${label}.result[${referenceIndex}]`, true)
          if (state !== null) {
            states.push(state)
            if (!resolvedPaths.includes(state.report.path)) resolvedPaths.push(state.report.path)
          }
        }
        const missingResult = paths.length === 0 || states.length !== paths.length
        const statuses = explicitStatuses(attempt, label)
        const providerInterrupted = attempt.providerInterrupted === true || attempt.rateLimited === true || statuses.some(interruptionStatus)
        const provisioningInterrupted = attempt.provisioningInterrupted === true || attempt.provisioningFailed === true
          || typeof attempt.provisioningError === 'string' || attempt.status === 'provisioning-failed'
          || missingResult && (attempt.timedOut === true || typeof attempt.spawnError === 'string' && attempt.spawnError.length > 0)
        const invocationInterrupted = providerInterrupted || provisioningInterrupted
        for (const state of states) {
          state.providerInterrupted ||= providerInterrupted
          state.invocationInterrupted ||= invocationInterrupted
          if (state.report.model.value === null) state.report.model = modelIdentity(state.parsed, attempt, entry, manifest)
          if (state.report.candidate.value === null) state.report.candidate = candidateIdentity(attempt, entry, manifest)
        }
        const exitCode = attempt.code === null || attempt.exitCode === null ? null
          : attempt.code !== undefined ? nonnegative(attempt.code, `${label}.code`)
            : attempt.exitCode !== undefined ? nonnegative(attempt.exitCode, `${label}.exitCode`) : null
        const signal = optionalText(attempt.signal, `${label}.signal`)
        const attemptNumber = attempt.number === undefined ? attemptIndex + 1 : nonnegative(attempt.number, `${label}.number`)
        const firstParsed = states[0]?.parsed ?? null
        invocations.push({
          id: `manifest:${manifestIndex}:entry:${entryIndex}:attempt:${attemptIndex}`,
          kind: kind === 'unknown' ? firstParsed?.kind ?? 'unknown' : kind,
          caseId,
          mode,
          attempt: attemptNumber,
          resultPaths: resolvedPaths,
          recordedResultPaths: paths,
          missingResult,
          exitCode,
          signal,
          status: invocationStatus(attempt, missingResult, providerInterrupted, provisioningInterrupted),
          model: modelIdentity(firstParsed, attempt, entry, manifest),
          candidate: candidateIdentity(attempt, entry, manifest),
          providerStatuses: statuses,
          providerInterrupted,
          provisioningInterrupted,
          metadata: attempt,
        })
      }
    }
  }

  for (let index = 0; index < options.results.length; index += 1) {
    const requested = options.results[index]!
    const before = resultStates.size
    const state = await loadResult(requested, `--result[${index}]`, false)
    if (state === null) throw new Error(`cannot read result ${requested}`)
    if (resultStates.size === before) continue
    invocations.push({
      id: `result:${index}`,
      kind: state.parsed.kind,
      caseId: state.parsed.caseId,
      mode: state.parsed.mode,
      attempt: null,
      resultPaths: [state.report.path],
      recordedResultPaths: [requested],
      missingResult: false,
      exitCode: null,
      signal: null,
      status: state.parsed.taskPassed ? 'passed' : 'failed',
      model: modelIdentity(state.parsed, null, null, null),
      candidate: { value: null, source: 'unknown' },
      providerStatuses: [],
      providerInterrupted: false,
      provisioningInterrupted: false,
      metadata: {},
    })
  }

  const results = [...resultStates.values()].map(state => state.report)
  const failedGates: GateReference[] = []
  const blockedGates: GateReference[] = []
  const observations: ObservationReference[] = []
  for (const state of resultStates.values()) {
    for (const gate of state.parsed.gates) {
      const reference = { ...gate, resultPath: state.report.path, kind: state.parsed.kind, caseId: state.parsed.caseId, mode: state.parsed.mode }
      if (gate.passed === false) failedGates.push(reference)
      else if (gate.passed === null) blockedGates.push(reference)
    }
    for (const gate of state.parsed.observations) {
      observations.push({
        ...gate,
        resultPath: state.report.path,
        kind: state.parsed.kind,
        caseId: state.parsed.caseId,
        mode: state.parsed.mode,
        outcome: gate.passed === true ? 'passed' : gate.passed === false ? 'failed' : 'blocked',
      })
    }
  }

  const aspectCounts: Record<NativeAspect, { passed: number; failed: number; unverified: number; missing: number }> = {
    authoring: { passed: 0, failed: 0, unverified: 0, missing: 0 },
    evidence: { passed: 0, failed: 0, unverified: 0, missing: 0 },
    nativeValidation: { passed: 0, failed: 0, unverified: 0, missing: 0 },
    nativeLifecycle: { passed: 0, failed: 0, unverified: 0, missing: 0 },
  }
  for (const result of results.filter(result => result.kind === 'native')) {
    for (const aspect of nativeAspects) {
      const status = result.nativeAspects[aspect]?.status
      const counts = aspectCounts[aspect]
      if (status === undefined) counts.missing += 1
      else if (status === 'passed') counts.passed += 1
      else if (status === 'failed') counts.failed += 1
      else counts.unverified += 1
    }
  }

  const measurementUsage = zeroUsage()
  const completeUsage = zeroUsage()
  let measuredResults = 0
  let usageMeasuredResults = 0
  let completeUsageResults = 0
  let incompleteUsageResults = 0
  let durationMs = 0
  let completeCaseDurationMs = 0
  let authoringPhaseCoverage = 0
  let lifecyclePhaseCoverage = 0
  for (const state of resultStates.values()) {
    const selected = state.parsed.measurement ?? sumPhases(state.parsed.phaseMeasurements)
    if (state.parsed.phaseMeasurements.authoring !== undefined) authoringPhaseCoverage += 1
    if (state.parsed.phaseMeasurements.lifecycle !== undefined) lifecyclePhaseCoverage += 1
    if (selected === null) continue
    measuredResults += 1
    durationMs += selected.durationMs
    if (selected.usage !== null) { usageMeasuredResults += 1; addUsage(measurementUsage, selected.usage) }
    if (selected.usageComplete && selected.usage !== null) {
      completeUsageResults += 1
      completeCaseDurationMs += selected.durationMs
      addUsage(completeUsage, selected.usage)
    } else incompleteUsageResults += 1
  }

  const guidanceJudgments: GuidanceJudgment[] = []
  const dimensions = [
    ['loader', 'focused-skill-loaded'],
    ['workflow', 'focused-workflow-acquired'],
    ['hostGuidance', 'host-workflow-loaded'],
  ] as const
  for (const state of resultStates.values()) {
    for (const [dimension, suffix] of dimensions) {
      const gates = state.parsed.gates.filter(gate => gate.name === suffix || gate.name.endsWith(`-${suffix}`)
        || dimension === 'hostGuidance' && /^lifecycle-host-(?:sync|archive)-guidance$/u.test(gate.name))
      const granularity = state.parsed.kind === 'public' ? 'public-turn' : 'native-combined'
      const agentUnits = state.parsed.kind === 'public'
        ? Math.max(state.parsed.publicTurns, state.parsed.gates.filter(gate => /^agent-turn-\d+$/u.test(gate.name)).length)
        : Math.max(1, state.parsed.gates.filter(gate => gate.name === 'agent-turn' || gate.name.endsWith('-agent-turn')).length, gates.length)
      const eligible = dimension === 'hostGuidance' && state.parsed.kind === 'public' ? gates.length
        : dimension === 'hostGuidance' ? Math.max(1, gates.length) : agentUnits
      for (const gate of gates) {
        guidanceJudgments.push({
          resultPath: state.report.path,
          invocationId: null,
          kind: state.parsed.kind,
          caseId: state.parsed.caseId,
          mode: state.parsed.mode,
          granularity,
          dimension,
          outcome: gate.passed === true ? 'passed' : gate.passed === false ? 'failed' : 'blocked',
          gateName: gate.name,
          detail: gate.detail,
          blockedBy: gate.blockedBy ?? null,
        })
      }
      for (let missing = gates.length; missing < eligible; missing += 1) {
        guidanceJudgments.push({
          resultPath: state.report.path,
          invocationId: null,
          kind: state.parsed.kind,
          caseId: state.parsed.caseId,
          mode: state.parsed.mode,
          granularity,
          dimension,
          outcome: state.invocationInterrupted ? 'interrupted' : 'unobserved',
          gateName: null,
          detail: state.invocationInterrupted ? 'invocation interrupted before this judgment was recorded' : 'eligible execution has no recorded judgment',
          blockedBy: null,
        })
      }
    }
  }
  for (const invocation of invocations.filter(item => item.missingResult)) {
    const interrupted = invocation.providerInterrupted || invocation.provisioningInterrupted
    for (const [dimension] of dimensions) {
      if (dimension === 'hostGuidance' && invocation.kind !== 'native') continue
      guidanceJudgments.push({
        resultPath: null,
        invocationId: invocation.id,
        kind: invocation.kind,
        caseId: invocation.caseId,
        mode: invocation.mode,
        granularity: 'invocation',
        dimension,
        outcome: interrupted ? 'interrupted' : 'unobserved',
        gateName: null,
        detail: interrupted ? `${invocation.status}; no result artifact recorded` : 'no result artifact recorded',
        blockedBy: null,
      })
    }
  }

  const uniqueResultCases = new Set(results.map(result => `${result.kind}\u0000${result.caseId}\u0000${result.mode}`))
  const attemptedCases = new Set(invocations.map(item => `${item.kind}\u0000${item.caseId}\u0000${item.mode}`))
  const expected = expectedCoverageAvailable ? expectedCaseModes ?? 0 : null
  const guidance: Omit<EvalReport['guidance'], 'judgments'> = {
    loader: {
      totals: rate(guidanceJudgments.filter(item => item.dimension === 'loader')),
      publicTurns: rate(guidanceJudgments.filter(item => item.dimension === 'loader'), 'public-turn'),
      nativeCombined: rate(guidanceJudgments.filter(item => item.dimension === 'loader'), 'native-combined'),
    },
    workflow: {
      totals: rate(guidanceJudgments.filter(item => item.dimension === 'workflow')),
      publicTurns: rate(guidanceJudgments.filter(item => item.dimension === 'workflow'), 'public-turn'),
      nativeCombined: rate(guidanceJudgments.filter(item => item.dimension === 'workflow'), 'native-combined'),
    },
    hostGuidance: {
      totals: rate(guidanceJudgments.filter(item => item.dimension === 'hostGuidance')),
      publicTurns: rate(guidanceJudgments.filter(item => item.dimension === 'hostGuidance'), 'public-turn'),
      nativeCombined: rate(guidanceJudgments.filter(item => item.dimension === 'hostGuidance'), 'native-combined'),
    },
  }

  return {
    schemaVersion: 1,
    repositoryRoot,
    sources: [...sourceStates.values()].map(source => ({ ...source })),
    duplicates,
    coverage: {
      attempts: invocations.length,
      results: results.length,
      missingResults: invocations.filter(item => item.missingResult).length,
      uniqueCaseModes: uniqueResultCases.size,
      attemptedCaseModes: attemptedCases.size,
      expectedCaseModes: expected,
      pendingCaseModes: expected === null ? null : Math.max(0, expected - attemptedCases.size),
    },
    invocations,
    results,
    verdicts: {
      public: {
        passed: results.filter(result => result.kind === 'public' && result.taskPassed).length,
        failed: results.filter(result => result.kind === 'public' && !result.taskPassed).length,
      },
      native: {
        certified: results.filter(result => result.kind === 'native' && result.certified === true).length,
        notCertified: results.filter(result => result.kind === 'native' && result.certified === false).length,
      },
      nativeAspects: aspectCounts,
      failedGates,
      blockedGates,
    },
    interruptions: {
      provider: invocations.filter(item => item.providerInterrupted).length,
      provisioning: invocations.filter(item => item.provisioningInterrupted).length,
      missingResult: invocations.filter(item => item.missingResult).length,
    },
    measurements: {
      eligibleResults: results.length,
      measuredResults,
      missingResults: results.length - measuredResults,
      usageMeasuredResults,
      completeUsageResults,
      incompleteUsageResults,
      durationMs,
      usage: measurementUsage,
      completeCaseDurationMs,
      completeCaseUsage: completeUsage,
      nativePhaseCoverage: { authoring: authoringPhaseCoverage, lifecycle: lifecyclePhaseCoverage },
      timingBoundary: {
        public: 'sum of recorded scored public agent-turn durations',
        native: 'sum of recorded scored native phase durations; absent historical phases remain unavailable',
        excluded: ['provisioning', 'independent judges', 'test-user responders', 'research interviews'],
      }
    },
    guidance: { ...guidance, judgments: guidanceJudgments },
    integrationObservations: {
      passed: observations.filter(item => item.outcome === 'passed').length,
      failed: observations.filter(item => item.outcome === 'failed').length,
      blocked: observations.filter(item => item.outcome === 'blocked').length,
      records: observations,
    },
    groups: {
      byCaseMode: groupSummaries(invocations, results, item => `${item.kind}:${item.caseId}:${item.mode}`),
      byModelCandidate: groupSummaries(invocations, results, item => {
        const uniqueUnknown = item.resultPaths[0] ?? item.id
        return `model=${item.model.value ?? `unknown@${uniqueUnknown}`};candidate=${item.candidate.value ?? `unknown@${uniqueUnknown}`}`
      }),
    },
  }
}

function parseArguments(argumentsList: readonly string[]): { readonly options: BuildOptions; readonly json: boolean } {
  const results: string[] = []
  const manifests: string[] = []
  let json = false
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--json') json = true
    else if (argument === '--result' || argument === '--manifest') {
      const value = argumentsList[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${argument}`)
      if (argument === '--result') results.push(value)
      else manifests.push(value)
      index += 1
    } else throw new Error(`unknown argument ${String(argument)}`)
  }
  return { options: { results, manifests }, json }
}

function percent(rateValue: number | null): string {
  return rateValue === null ? 'unavailable' : `${(rateValue * 100).toFixed(1)}%`
}

export function renderEvalReport(report: EvalReport): string {
  const lines = [
    'Evaluation report',
    `Sources: ${report.sources.length}; attempts: ${report.coverage.attempts}; results: ${report.coverage.results}; missing results: ${report.coverage.missingResults}; duplicate references: ${report.duplicates.length}`,
    `Case/mode coverage: results=${report.coverage.uniqueCaseModes}; attempted=${report.coverage.attemptedCaseModes}; expected=${report.coverage.expectedCaseModes ?? 'unavailable'}; pending=${report.coverage.pendingCaseModes ?? 'unavailable'}`,
    `Public verdicts: passed=${report.verdicts.public.passed}; failed=${report.verdicts.public.failed}`,
    `Native verdicts: certified=${report.verdicts.native.certified}; not-certified=${report.verdicts.native.notCertified}`,
    `Interruptions: provider=${report.interruptions.provider}; provisioning=${report.interruptions.provisioning}; missing-result=${report.interruptions.missingResult}`,
    `Measurements: measured=${report.measurements.measuredResults}/${report.measurements.eligibleResults}; complete-usage=${report.measurements.completeUsageResults}; incomplete-usage=${report.measurements.incompleteUsageResults}; durationMs=${report.measurements.durationMs}`,
  ]
  for (const [name, item] of Object.entries({ loader: report.guidance.loader, workflow: report.guidance.workflow, host: report.guidance.hostGuidance })) {
    lines.push(`Guidance ${name}: passed=${item.totals.passed}; failed=${item.totals.failed}; blocked=${item.totals.blocked}; unobserved=${item.totals.unobserved}; interrupted=${item.totals.interrupted}; observed=${item.totals.observed}/${item.totals.eligible}; failure-rate=${percent(item.totals.failureRate)}`)
  }
  lines.push(`Non-gating acquisition observations: passed=${report.integrationObservations.passed}; failed=${report.integrationObservations.failed}; blocked=${report.integrationObservations.blocked}`)
  lines.push('Selected sources:')
  for (const source of report.sources) lines.push(`- ${source.role} ${relative(repositoryRoot, source.path) || '.'} sha256=${source.sha256}`)
  return `${lines.join('\n')}\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const parsed = parseArguments(process.argv.slice(2))
    const report = await buildEvalReport(parsed.options)
    process.stdout.write(parsed.json ? `${JSON.stringify(report, null, 2)}\n` : renderEvalReport(report))
  } catch (error) {
    process.stderr.write(`eval report: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
