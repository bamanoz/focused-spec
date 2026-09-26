export const OPEN_SPEC_SKILLS = [
  'openspec-propose',
  'openspec-apply-change',
  'openspec-update-change',
  'openspec-sync-specs',
  'openspec-archive-change',
  'openspec-explore',
] as const

export interface EvalTurn {
  readonly promptPath: string
  readonly skills: readonly string[]
  readonly checkpoint?: 'proposal'
}

export interface EvalCase {
  readonly id: string
  readonly description: string
  readonly overlay?: string
  readonly source: 'files' | 'openspec'
  readonly changeName?: string
  readonly turns: readonly EvalTurn[]
  readonly expectedScenarioId: string
  readonly expectedEvidenceCount: number
  readonly maximumEvidenceCount?: number
  readonly expectedSelectorFragments: readonly string[]
  readonly expectedSelectorAlternatives?: readonly string[]
}

export interface AgentRequest {
  readonly workspace: string
  readonly prompt: string
  readonly skills: readonly string[]
  readonly model?: string
  readonly timeoutMs: number
}

export interface AgentResult {
  readonly success: boolean
  readonly output: string
  readonly exitCode: number | null
  readonly durationMs: number
}

export interface AgentDriver {
  run(request: AgentRequest): Promise<AgentResult>
}

export interface EvalGate {
  readonly name: string
  readonly passed: boolean
  readonly detail: string
}

export interface EvalResult {
  readonly caseId: string
  readonly passed: boolean
  readonly workspace: string
  readonly turns: readonly AgentResult[]
  readonly gates: readonly EvalGate[]
}

export interface EvalRunOptions {
  readonly caseId: string
  readonly model?: string
  readonly openspecSkillsDir?: string
  readonly keepWorkspace?: boolean
  readonly timeoutMs?: number
}
