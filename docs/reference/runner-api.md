# Plugin API reference

## Format API 2

Import public types from `focused-spec/format`:

```ts
export interface SourceLocation {
  readonly path: string
  readonly line: number
}

export interface ParsedItem {
  readonly line: number
  readonly name: string
  readonly nativeIds: readonly string[]
  readonly markerId?: string
  readonly evidence?: readonly string[]
  readonly evidenceLocations?: readonly SourceLocation[]
}

export interface FormatDiagnostic {
  readonly line?: number
  readonly message: string
  readonly focusedId?: string
}

export interface ParseRequest {
  readonly projectRoot: string
  readonly path: string
  readonly source: string
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface ParseResult {
  readonly items: readonly ParsedItem[]
  readonly diagnostics: readonly FormatDiagnostic[]
}

export interface CatalogDocument {
  readonly path: string
  readonly scope: string
  readonly items: readonly ParsedItem[]
}

export interface BindRequest {
  readonly projectRoot: string
  readonly documents: readonly CatalogDocument[]
  readonly selection: { readonly scope?: string; readonly scenarioId?: string }
  readonly options: JsonValue
  readonly signal: AbortSignal
}

export interface Enrollment {
  readonly document: number
  readonly item: number
  readonly id: string
  readonly evidence: readonly string[]
  readonly evidenceLocations?: readonly SourceLocation[]
  readonly location: SourceLocation
}

export interface SourceClaim {
  readonly key: string
  readonly location: SourceLocation
}

export interface BindDiagnostic {
  readonly location: SourceLocation
  readonly message: string
  readonly scope?: string
  readonly focusedId?: string
}

export interface BindResult {
  readonly enrollments: readonly Enrollment[]
  readonly diagnostics: readonly BindDiagnostic[]
  readonly sourceClaims: readonly SourceClaim[]
}

export interface FormatPlugin {
  readonly apiVersion: 2
  parse(request: ParseRequest): ParseResult | Promise<ParseResult>
  bind?(request: BindRequest): BindResult | Promise<BindResult>
}
```

The default export is an object with `apiVersion: 2`. `parse` runs once per discovered document and returns native items plus document-local diagnostics. Core supplies the canonical `projectRoot`, project-relative `path`, document `source`, configured JSON-compatible `options`, and abort `signal`; an adapter cannot override path or scope. A parsed item can enroll itself by returning `markerId` with nonempty `evidence`. `evidenceLocations`, when supplied, is parallel to `evidence`: it has exactly one positive location for each reference in the same order, allowing a malformed second AND member to be reported at its own metadata row.

`bind` is optional and runs once after parsing in the same bounded command-scoped format session. It receives the complete selected catalog, including documents parsed by other adapters, together with current scope/scenario selection. Core invokes every layout-referenced binding-capable adapter even when that adapter parsed no documents. This supports an explicit registry adapter that binds mixed native formats and still reports dangling selected registrations.

An enrollment addresses one catalog item by actual `document` and `item` array indices, supplies the exact opaque ID, nonempty evidence, enrollment provenance, and optional parallel per-reference provenance. It cannot forge a document path/scope, target an absent item, override a conflicting marker, or enroll an already enrolled item. `SourceClaim.key` is an opaque canonical identity chosen by the adapter; core compares claims across adapters to reject overlapping evidence ownership without interpreting paths or storage formats. It never opens a diagnostic or evidence-location path returned by a plugin.

The core public `Scenario` keeps `path`/`line` at the actual native item. Its optional `evidenceLocation` stores the enrollment origin independently of optional per-reference `evidenceLocations`; validation and resolution diagnostics fall back through those origins before the native coordinates. Core never opens either evidence-origin path.

Core validates every response shape and global invariant before runner resolution. Invalid lines, names, IDs, location-array lengths, references, catalog targets, duplicate `(scope, ID)` values, competing enrollments, overlapping source claims, crashes, timeouts, and generic host failures are violations. Selection-aware bind diagnostics carry known `scope`/`focusedId`; structural/source diagnostics remain blocking. Format API 1 is rejected without a compatibility shim.

IDs are opaque: core requires a nonblank string without control characters and preserves its exact case and value. Representation and escaping belong to the format. Source `line` values are diagnostic coordinates, not item identity; distinct items may share one line and remain independently addressable by catalog index.

Formats supply normalized evidence but never execute it. Core retains discovery, document scope/path, response validation, selection, reference validation, resolution, and execution. A package/subpath resolves from the consuming project using ESM import conditions; a project module stays inside the selected root. Core has no built-in Markdown/Gherkin/inline parser, evidence registry, or format inference.

## Plugin documentation metadata

Public plugin documentation is discovered independently of Format API 2 and Runner API 1 execution. An installed package needs no extra manifest field when its contract is package-root `README.md`; optional manifest `focusedSpec.documentation` may select another relative `.md` or `.markdown` file. A project-module format or runner registration may add `documentation: <project-relative Markdown file>` beside `module`. That field is invalid beside `package`, is not passed to the plugin, and its absence affects only `plugin-docs`, not parsing, resolution, or execution.

The CLI resolves and reads the selected document without importing plugin code. Documentation path containment, strict UTF-8, provenance, output, and sequential composition semantics are defined by the [`plugin-docs` CLI contract](cli.md#installed-plugin-documentation); they do not change either plugin API version or add documentation fields to runtime request objects.

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
