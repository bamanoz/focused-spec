import type { JsonValue, ResolvedTarget, TargetResult } from './runner-api.js'
export const STABLE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/u


export interface NativeItem {
  readonly scope: string
  readonly path: string
  readonly line: number
  readonly name: string
  readonly markerId?: string
  readonly nativeIds: readonly string[]
}

export interface NativeDocument {
  readonly path: string
  readonly scope: string
  readonly items: readonly NativeItem[]
  readonly violations: readonly Violation[]
}

export interface EvidenceEntry {
  readonly scope: string
  readonly id: string
  readonly line: number
  readonly registryPath: string
  readonly evidence: readonly string[]
  readonly source?: { readonly path: string; readonly nativeId: string }
}

export interface Scenario {
  readonly id: string
  readonly scope: string
  readonly path: string
  readonly line: number
  readonly name: string
  readonly evidence: readonly string[]
}

export interface SpecDocument {
  readonly path: string
  readonly scope: string
  readonly scenarios: readonly Scenario[]
}

export interface Violation {
  readonly path: string
  readonly line?: number
  readonly scenarioId?: string
  readonly message: string
}

export type PluginConfig = (
  | { readonly package: string; readonly module?: never }
  | { readonly module: string; readonly package?: never }
) & {
  readonly timeoutMs?: number
  readonly options?: JsonValue
}

export type FormatConfig = PluginConfig
export type RunnerConfig = PluginConfig & { readonly cwd?: string }

export interface DocumentLayout {
  readonly match: string
  readonly format: string
  readonly scope?: string
  readonly exclude?: readonly string[]
}

export interface FocusedSpecConfig {
  readonly version: 4
  readonly specifications: {
    readonly formats: Readonly<Record<string, FormatConfig>>
    readonly documents: readonly DocumentLayout[]
  }
  readonly evidence?: {
    readonly files: readonly string[]
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
