# Design

## Context

See proposal.md for motivation. Existing CLI `PhaseTimings` contains optional validation/resolution/execution durations and total elapsed time. `planEvidence` deduplicates selectors and calls each runner once for resolution; official Go and pytest plugins then spawn discovery sequentially per selector. Vitest already performs one batched collection. `sources.ts` reuses one `FormatClient` per configured format ID; plugin import is lazy on the first parse request. The scheduler may invoke partition and multiple overlapping run groups. These are distinct measurements, not one duration per test.

Research baseline on the current workspace: `node node_modules/focused-spec/dist/cli.js validate --strict --timings --json` reported 183 scenarios / 212 targets, validation 163.50 ms, resolution 842.06 ms, total 1011.10 ms. Only Vitest is registered here. This measures the existing phase API; it does not establish timings for another project or implement detailed telemetry.

## Goals / Non-Goals

**Goals:** Attribute wall time to configured plugin operations and actual selected workloads; expose individual document parses and concurrency intervals; preserve partial diagnostics and existing untimed behavior.

**Non-Goals:** Plugin-internal subprocess/CPU profiling, changing runner discovery behavior, permanent caches, distributed tracing, per-test execution durations, new CLI flags or a new supported library tracing API. No config or plugin API version change, instruction-distribution change, release or publication.

## Decisions

### 1. Extend the existing opt-in CLI result

Keep `--timings` and the current phase properties. Add two flat arrays, including empty arrays when collection is enabled but nothing was attempted. Entries represent actual core-facing invocations, not configured plugins or evidence occurrences. Repeated runner IDs are expected for separate operations/groups. No aggregate duplicate fields: consumers can sum durations per identity for work attribution, but not call those sums command wall time.

Proposed CLI JSON contract (TypeScript notation; these are output shapes, not new plugin methods or promised package exports):

```ts
type TimingOutcome = 'completed' | 'error'

interface OperationTiming {
  readonly startedMs: number // offset from the command's monotonic origin
  readonly durationMs: number // elapsed wall time, not CPU time
  readonly outcome: TimingOutcome
}

type RunnerOperationTiming = OperationTiming & (
  | { readonly runnerId: string; readonly operation: 'resolve'; readonly selectorCount: number }
  | { readonly runnerId: string; readonly operation: 'partition' | 'run'; readonly targetCount: number }
)

interface FormatOperationTiming extends OperationTiming {
  readonly formatId: string
  readonly path: string // project-relative, normalized existing document path
  readonly scope: string
  readonly coldStart: boolean
}

interface Timings {
  readonly validationMs?: number
  readonly resolutionMs?: number
  readonly executionMs?: number
  readonly totalMs: number
  readonly runnerOperations: readonly RunnerOperationTiming[]
  readonly formatOperations: readonly FormatOperationTiming[]
}
```

Resolve `selectorCount` counts the unique input selectors actually passed, not scenario references. Partition/run `targetCount` counts the input targets to that invocation, not all project tests. No selectors, test source text or absolute paths are copied into telemetry. Sort each array by `startedMs`, then configured ID and operation or path/scope; exact ties use stable invocation order.

### 2. Measure core-facing operations, not guessed internal work

Use the existing monotonic `performance.now()` command origin. Runner boundaries enclose `resolveRunnerTargets`, `partitionRunnerTargets` and `runRunnerTargets`, including host creation/loading, IPC, plugin execution, response validation and normal host settlement. Do not time scheduler queueing as execution work. Record partition only when actually invoked (concurrency greater than one); an absent optional plugin partition can return normally and still has an attempted core operation.

Format boundaries enclose `FormatClient.parse`, after source reading and before binding. They include initial host startup, lazy import, IPC, parsing and normalization. `coldStart` identifies the first request on a newly created client/host; it does not estimate or subtract initialization time. Never label that entire duration as pure parser computation. Unknown format configuration or a failed source read before parse entry does not create a parse row.

Alternative rejected: plugin-reported elapsed times or nested subprocess telemetry. That would require protocol/API changes and cannot uniformly describe arbitrary trusted plugins. Core measurements locate the next profiling target without pretending to explain plugin internals.

### 3. Preserve errors and opt-in cost

Create a command-scoped collector only when `--timings` is present. Thread an optional internal sink through existing call paths; avoid global state, AsyncLocalStorage, plugins depending on telemetry and copying target/selector arrays. Existing package callers without collection remain valid; no new supported tracing API is introduced. Check exported-symbol references before changing any signature during implementation.

Record attempted intervals in finally paths, with `completed` only after a valid operation response; thrown errors, malformed responses, crashes and timeouts are `error`. A resolve response containing missing-selector errors, a parse response containing native diagnostics or a run response with a failed test is still a completed call. Existing violations/status fields remain the reason the command fails. Do not fabricate rows or hide failures. A successful timing observer must not change scheduler admission, result aggregation or resolution cardinality.

No timers, detailed row allocations or array sorting for ordinary untimed commands. No extra framework discovery or test invocation to obtain durations. Storage is linear in attempted document parses and plugin invocations, not the number of references or subprocesses.

### 4. Text output and illustrative response

Keep the existing `timings:` phase line. Append one runner line and one format line per attempted operation, exposing offset, duration, count, outcome and cold-start marker as appropriate. Output stays on the existing success/error stream; JSON remains one result object. Numbers below are illustrative, not measured new-feature output:

```json
{
  "valid": true,
  "scenarios": 2,
  "plannedEvidence": 0,
  "targets": 4,
  "validationScope": { "scopes": { "mode": "all" } },
  "timings": {
    "validationMs": 120,
    "resolutionMs": 8400,
    "totalMs": 8540,
    "runnerOperations": [
      { "runnerId": "go", "operation": "resolve", "selectorCount": 2, "startedMs": 125, "durationMs": 600, "outcome": "completed" },
      { "runnerId": "pytest", "operation": "resolve", "selectorCount": 2, "startedMs": 730, "durationMs": 7780, "outcome": "completed" }
    ],
    "formatOperations": [
      { "formatId": "markdown", "path": "specs/auth.md", "scope": "current", "coldStart": true, "startedMs": 10, "durationMs": 90, "outcome": "completed" },
      { "formatId": "markdown", "path": "specs/access.md", "scope": "current", "coldStart": false, "startedMs": 105, "durationMs": 3, "outcome": "completed" }
    ]
  }
}
```

```text
timings: validation 120.00 ms, resolution 8400.00 ms, total 8540.00 ms
  runner go resolve: 600.00 ms, start 125.00 ms, selectors 2, completed
  runner pytest resolve: 7780.00 ms, start 730.00 ms, selectors 2, completed
  format markdown [current] specs/auth.md: 90.00 ms, start 10.00 ms, cold-start, completed
  format markdown [current] specs/access.md: 3.00 ms, start 105.00 ms, reused-host, completed
```

`run` additionally reports each actual partition/run invocation. `validate` has no run/partition rows; `--syntax-only` has format rows but no runner rows. Untimed commands have no `timings` at all. An agent can identify pytest resolution as the next profiling target from the example, but cannot infer how many pytest subprocesses were spawned from `selectorCount` alone.

### 5. Exact planned executable evidence

Planning creates no registry or product/test changes. During authorized apply, retain the two existing native timing IDs and bind all six occurrences explicitly in `.focused-spec/evidence/scenario-execution.yaml`, under the working change scope first and surviving scope during publication:

| Native ID | Intended exact evidence | Observable proof |
| --- | --- | --- |
| execution.timings.opt-in | vitest::test/cli.spec.ts::focused-spec CLI > reports phase timings only when requested | Extend existing paired timed/untimed consumer check; preserve results and opt-in text/JSON behavior. |
| execution.timings.failure | vitest::test/cli.spec.ts::focused-spec CLI > reports reached timings on unresolved evidence without starting execution | Extend existing unresolved-selection check; completed resolution row present, no execution row/phase. |
| execution.timings.runner-attribution | vitest::test/cli.spec.ts::focused-spec CLI > attributes timed runner operations to selected unique workloads | Real CLI with two deterministic plugin fixtures, shared reference, excluded runner and serial execution; verify actual selected counts and identities rather than mock forwarding. |
| execution.timings.format-attribution | vitest::test/cli.spec.ts::focused-spec CLI > attributes document parsing to configured formats and reused hosts | Real CLI with selected/excluded documents, two format IDs and reused host; syntax-only and native-diagnostic results distinguish attempted calls. |
| execution.timings.operation-errors | vitest::test/cli.spec.ts::focused-spec CLI > retains attempted plugin timings across errors and negative results | Real CLI exercised with parse/resolve/run error and timeout boundaries; valid missing-target or FAIL responses remain completed, failed calls remain error, later operations absent. |
| execution.timings.overlap | vitest::test/integration.spec.ts::project-local TypeScript runners > reports overlapping admitted group intervals without summing wall time | Real scheduler with barrier-controlled independent and conflicting groups; intervals demonstrate admission/overlap regardless of completion order and result aggregation is unchanged. |

Keep new tests only for these genuinely uncertain boundaries. Use barriers/observable operations, not exact wall-clock assertions, arbitrary sleeps or assertions about source wiring. After implementation, an owned throwaway CLI probe executes timed/untimed validate, syntax-only and run on a real small installed-package fixture, compares non-timing results and demonstrates attribution. Controlled product regressions in the timing collector/boundaries must make each changed exact contract assertion fail and pass again after restoration. No detailed timing PASS is claimed in this proposal.

## Risks / Trade-offs

- First parse includes initialization → expose `coldStart` and explicitly document whole-call semantics; defer startup-versus-CPU decomposition until measured need.
- Parallel operation durations overlap → retain start offsets and phase wall totals; do not publish sum as total elapsed time.
- Large document selections increase timed output → linear opt-in rows; no source/selector payloads or duplicated aggregates. No silent truncation that hides slow operations.
- Detail only locates a slow plugin → deeper subprocess measurements remain runner-local profiling, not fabricated core insight.
- Timing fixtures can become flaky → use barriers and interval relationships, not exact durations or broad performance thresholds.
- Additive JSON fields affect exact-schema consumers → update CLI reference explicitly; preserve all existing properties and ordinary unflagged output.

## Migration Plan

Implement in core without plugin version/config migrations; update CLI timing documentation and authorized scope-local evidence with the changed contract. Run narrow checks, real CLI smoke, `npm test`, strict native validation and all-scope focused execution. Publish specs through OpenSpec sync/archive only after implementation approval and verification. No release is requested. Rollback is removal of the additive timing details, not rewriting runner/format plugins.
