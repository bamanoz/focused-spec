export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[]

export interface RunnerContext {
  readonly projectRoot: string
  readonly cwd: string
  readonly runnerId: string
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface ResolveRequest extends RunnerContext {
  readonly selectors: readonly string[]
}

export interface SourceLocation {
  readonly path: string
  readonly line?: number
}

export interface ResolvedTarget {
  readonly selector: string
  readonly targetId: string
  readonly displayName: string
  readonly source?: SourceLocation
  readonly data?: JsonValue
}

export interface ResolveError {
  readonly selector: string
  readonly message: string
}

export interface ResolveResponse {
  readonly targets: readonly ResolvedTarget[]
  readonly errors: readonly ResolveError[]
}

export interface RunRequest extends RunnerContext {
  readonly targets: readonly ResolvedTarget[]
}

export type TargetStatus = 'pass' | 'fail' | 'skip'

export interface TargetResult {
  readonly targetId: string
  readonly status: TargetStatus
  readonly diagnostic?: string
}

export interface RunResponse {
  readonly results: readonly TargetResult[]
}

export interface ResourceExecutionGroup {
  readonly targetIds: readonly string[]
  readonly resources: readonly string[]
  readonly exclusive?: never
}

export interface ExclusiveExecutionGroup {
  readonly targetIds: readonly string[]
  readonly exclusive: true
  readonly resources?: never
}

export type ExecutionGroup = ResourceExecutionGroup | ExclusiveExecutionGroup

export interface PartitionResponse {
  readonly groups: readonly ExecutionGroup[]
}

export interface RunnerPlugin {
  readonly apiVersion: 1
  resolve(request: ResolveRequest): Promise<ResolveResponse>
  run(request: RunRequest): Promise<RunResponse>
  partition?(request: RunRequest): Promise<PartitionResponse>
}
