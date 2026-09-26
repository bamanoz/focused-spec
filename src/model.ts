import type { JsonValue, ResolvedTarget, TargetResult } from './runner-api.js'


export interface Scenario {
  readonly scope: string
  readonly path: string
  readonly line: number
  readonly name: string
  readonly requirement?: string
  readonly revisions: readonly string[]
  readonly malformedRevisionLines: readonly number[]
  readonly malformedIdLines: readonly number[]
  readonly ids: readonly string[]
  readonly evidence: readonly string[]
  readonly malformedEvidenceLines: readonly number[]
  readonly whenCount: number
  readonly thenCount: number
}

export interface SpecDocument {
  readonly path: string
  readonly scope: string
  readonly scenarios: readonly Scenario[]
  readonly unenrolledScenarios: number
  readonly malformedScenarioHeadings: readonly number[]
}

export interface Violation {
  readonly path: string
  readonly line?: number
  readonly scenarioId?: string
  readonly message: string
}

export interface RunnerConfig {
  readonly module: string
  readonly cwd?: string
  readonly timeoutMs?: number
  readonly options?: JsonValue
}

export interface DocumentLayout {
  readonly match: string
  readonly scope?: string
  readonly exclude?: readonly string[]
}

export interface FocusedSpecConfig {
  readonly version: 2
  readonly specifications: {
    readonly documents: readonly DocumentLayout[]
  }
  readonly runners: Readonly<Record<string, RunnerConfig>>
  readonly execution?: {
    readonly maxConcurrentGroups?: number
  }
}

export interface EvidenceReference {
  readonly raw: string
  readonly planned: boolean
  readonly runnerId: string
  readonly selector: string
}

export interface PlannedTarget {
  readonly key: string
  readonly runnerId: string
  readonly config: RunnerConfig
  readonly target: ResolvedTarget
  readonly references: readonly string[]
}

export interface PlannedEvidence {
  readonly key: string
  readonly reference: string
}

export interface PlannedScenario {
  readonly scope: string
  readonly id: string
  readonly evidence: readonly PlannedEvidence[]
}

export interface RunnerGroup {
  readonly runnerId: string
  readonly config: RunnerConfig
  readonly targets: readonly PlannedTarget[]
}

export interface ExecutionPlan {
  readonly projectRoot: string
  readonly scenarios: readonly PlannedScenario[]
  readonly targets: readonly PlannedTarget[]
  readonly groups: readonly RunnerGroup[]
}

export type EvidenceStatus = 'PASS' | 'FAIL' | 'SKIP' | 'ERROR'

export interface EvidenceResult {
  readonly reference: string
  readonly status: EvidenceStatus
  readonly diagnostic?: string
}

export interface ScenarioResult {
  readonly scope: string
  readonly id: string
  readonly status: EvidenceStatus
  readonly evidence: readonly EvidenceResult[]
}

export interface ExecutionResult {
  readonly success: boolean
  readonly scenarios: readonly ScenarioResult[]
  readonly targetCount: number
}

export interface RunnerRunOutput {
  readonly results: readonly TargetResult[]
}
