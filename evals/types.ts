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
  readonly checkpoint?: 'proposal' | 'working-evidence'
}

export interface IntegrationCase {
  readonly source: 'openspec' | 'spec-kit' | 'inline' | 'typescript' | 'go'
  readonly mode: 'integrate' | 'recommend' | 'install' | 'revise' | 'author'
  readonly cli: boolean
}

export interface EvalCase {
  readonly id: string
  readonly description: string
  readonly overlay?: string
  readonly source: 'files' | 'openspec'
  readonly changeName?: string
  readonly turns: readonly EvalTurn[]
  readonly prescribedScenarioId?: string
  readonly expectedEvidenceCount: number
  readonly maximumEvidenceCount?: number
  readonly expectedSelectorFragments: readonly string[]
  readonly expectedSelectorAlternatives?: readonly string[]
  readonly editablePaths?: readonly string[]
  readonly registryPlacement?: 'reuse' | 'new-boundary'
  readonly evidenceStorage?: 'registry' | 'inline'
  readonly lifecycle?: 'inline-publication'
  readonly expectedRevisionTerms?: readonly string[]
  readonly integration?: IntegrationCase
}

export interface AgentRequest {
  readonly workspace: string
  readonly prompt: string
  readonly skills: readonly string[]
  readonly model?: string
  readonly timeoutMs: number
  readonly sessionDir?: string
  readonly resume?: string
  readonly tools?: string
  readonly systemPrompt?: string
  readonly appendSystemPrompt?: string
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

export interface EvalDiagnostic {
  readonly status: 'answered' | 'unavailable'
  readonly answer: string
  readonly transcript: string
  readonly detail: string
}

export interface EvalResult {
  readonly caseId: string
  readonly passed: boolean
  readonly workspace: string
  readonly turns: readonly AgentResult[]
  readonly gates: readonly EvalGate[]
  readonly diagnostic: EvalDiagnostic | null
}

export interface EvalRunOptions {
  readonly caseId: string
  readonly model?: string
  readonly openspecSkillsDir?: string
  readonly keepWorkspace?: boolean
  readonly timeoutMs?: number
}
