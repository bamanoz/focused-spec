# Plugin API reference

## Format API

Import public types from `focused-spec/format`:

```ts
export interface ParsedItem {
  readonly line: number
  readonly name: string
  readonly nativeIds: readonly string[]
  readonly markerId?: string
}

export interface FormatDiagnostic {
  readonly line?: number
  readonly message: string
  readonly focusedId?: string
}

export interface ParseResult {
  readonly items: readonly ParsedItem[]
  readonly diagnostics: readonly FormatDiagnostic[]
}

export interface ParseRequest {
  readonly path: string
  readonly source: string
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface FormatPlugin {
  readonly apiVersion: 1
  parse(request: ParseRequest): ParseResult | Promise<ParseResult>
}
```

The default export is an object with `apiVersion: 1`. Official adapters use `satisfies FormatPlugin` while retaining a concrete synchronous `parse` return type, so trusted tooling may call them directly without widening the result to a promise; third-party adapters may return synchronously or asynchronously. The adapter reports positive source lines, structural names, zero or more explicit native IDs, an optional direct focused marker ID, and structured diagnostics. Results contain no document path or scope; core owns discovery, scope and evidence binding.

Source lines are diagnostic coordinates, not item identity. Distinct normalized items may share a source line and bind independently; two registrations may not claim the same actual item.

Core validates every normalized result before binding evidence. Invalid lines, names, IDs, result shapes, crashes, timeouts, or generic host failures are violations and never cause extension inference or fallback to another adapter. Format code runs as trusted project code in a bounded child host, not a security sandbox.

The public core function and configuration types are exported from `focused-spec` and are asynchronous at the core boundary:

```ts
export type FormatConfig = (
  | { readonly package: string; readonly module?: never }
  | { readonly module: string; readonly package?: never }
) & {
  readonly options?: JsonValue
  readonly timeoutMs?: number
}

parseNativeDocument(
  projectRoot: string,
  path: string,
  source: string,
  scope: string,
  formatConfig: FormatConfig,
): Promise<NativeDocument>
```

Package/subpath resolution uses the consuming project's ESM import conditions; project modules remain inside the selected root. The core has no built-in Markdown/Gherkin parser and does not infer a format from `path`.

## Runner API

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

export type ExecutionGroup =
  | { readonly targetIds: readonly string[]; readonly resources: readonly string[]; readonly exclusive?: never }
  | { readonly targetIds: readonly string[]; readonly exclusive: true; readonly resources?: never }

export interface PartitionResponse {
  readonly groups: readonly ExecutionGroup[]
}

export interface RunnerPlugin {
  readonly apiVersion: 1
  resolve(request: ResolveRequest): Promise<ResolveResponse>
  run(request: RunRequest): Promise<RunResponse>
  partition?(request: RunRequest): Promise<PartitionResponse>
}
```

`resolve` returns `{ targets, errors }`; `run` returns `{ results }`. The host validates that every requested selector and every resolved target is represented exactly once.

Malformed host envelopes fail through ordinary runner errors, never a caller crash or a truthy success discriminator. Timeout settlement waits for host termination but is bounded independently of descendants retaining output pipes; plugins remain responsible for their own subprocess cleanup.

`partition` is optional and keeps `apiVersion: 1`. It receives the unique **selected** resolved targets after strict validation, only when `execution.maxConcurrentGroups` exceeds 1. With the default limit of 1 the host calls `run` once per runner and never calls `partition`. Without `partition`, a runner remains one exclusive invocation; its work cannot overlap other groups.

The runner owns its grouping policy (code, its own config, framework metadata, or another source). Core accepts only the returned groups: every selected `targetId` must occur in exactly one nonempty group, and no unknown ID may appear. Each group must declare **either** `exclusive: true` **or** a `resources` array of distinct nonempty strings, never both. `resources: []` asserts compatibility with all other nonexclusive groups; matching resource keys exclude overlap even across different runner IDs. An exclusive group runs alone. Unknown compatibility must be declared exclusive or reported as a runner error, not silently treated as `resources: []`. An invalid partition reports `ERROR` for that runner's targets before any of its groups execute; other valid runners still execute.

Core invokes `run` separately for each accepted group with just that group's `ResolvedTarget[]`. The runner must safely execute such subsets and return one actual result per target. Limits count runner-host invocations, **not** workers started by the underlying test framework. The resource scheduler coordinates only one `focused-spec run` invocation, not concurrent processes outside it.
