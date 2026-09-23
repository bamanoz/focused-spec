# Runner API reference

Import public types from `focused-spec/runner`.

```ts
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

export interface ResolvedTarget {
  readonly selector: string
  readonly targetId: string
  readonly displayName: string
  readonly source?: SourceLocation
  readonly data?: JsonValue
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

export interface RunnerPlugin {
  readonly apiVersion: 1
  resolve(request: ResolveRequest): Promise<ResolveResponse>
  run(request: RunRequest): Promise<RunResponse>
}
```

`resolve` returns `{ targets, errors }`; `run` returns `{ results }`. The host validates that every requested selector and every resolved target is represented exactly once.
