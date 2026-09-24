## Context

Today `src/cli.ts` calls `planEvidence` for strict validation and again for the selected run. Each call forks one resolver host per runner. `src/executor.ts` then invokes each runner once with all selected targets, serially. A scenario is a behavioral assertion, not necessarily a test invocation: evidence can be shared by multiple scenarios or span multiple runners. `RunnerPlugin` is a project-local, JSON-boundary API; its current `resolve`/`run` behavior and exact-result invariants must survive.

## Goals / Non-Goals

**Goals:** Avoid duplicate resolution on `run`; make costs observable on demand; enable bounded parallel execution only for independently executable target groups explicitly declared by their runner, including conflicts across runners; keep old plugins working and default execution serial.

**Non-Goals:** Scenario-level `PARALLEL` syntax; inferred resource safety; running targets separately unless a plugin partitions them; parallelizing inside a plugin or the underlying framework; locking resources against other CLI invocations or tools; guaranteed wall-time improvement on any given project.

## Decisions

### 1. Resolve once and project onto the execution selection

Keep strict structural validation and concrete resolution over the full validation document set. Retain the resolved plan and select scenarios from `targetDocuments` (plus optional `--scenario`) by document ownership and ID, not ID alone: a named scope may revise a baseline scenario with the same ID. Filter scenario evidence, deduplicate referenced `(runnerId, targetId)` keys and rebuild execution groups without another `resolve` call. A missing selected scenario remains an error even if validation succeeded; an empty baseline remains an empty execution. Preserve original validation violations before running any tests. Alternative—resolve only selected documents—loses errors in unselected scopes; a cross-command cache adds staleness and invalidation risks.

### 2. Measure phases explicitly, without altering default results

An opt-in `--timings` on `validate` and `run` reports nonnegative elapsed milliseconds for document discovery/structural validation, runner resolution, and (for run) runner execution; include total wall duration. For `--json`, add `timings` only with the flag, including durations reached before a validation failure; for text, print a compact timing footer to the existing command's output stream. Use monotonic elapsed time, not summed per-runner durations (which can overlap). A completed run's timing includes its scheduling wait; per-runner/group breakdowns are deliberately deferred. Alternative—always adding timing fields—breaks consumers of stable output and adds noise.
### 3. Runner-declared execution groups

Extend `RunnerPlugin` with an **optional** `partition(request: RunRequest): Promise<{ groups: readonly ExecutionGroup[] }>` method. Invoke it on *only selected unique targets* after strict validation **only when** `execution.maxConcurrentGroups > 1`; at the default limit of 1, keep one `run` invocation per runner with no partition round-trip. A group has `targetIds: readonly string[]` and either `resources: readonly string[]` (project-wide, opaque, nonempty resource keys; an empty set asserts independence from all other opted-in groups) or `exclusive: true` (cannot overlap any group). By implementing `partition`, the plugin attests that separate nonexclusive groups may run concurrently whenever their resource sets do not overlap and that `run` handles the supplied subset independently. `run` still receives `ResolvedTarget[]` and returns the existing result format. No partition method means one exclusive legacy group. Validate the entire partition atomically: each selected target ID appears exactly once, no unknown/duplicate IDs, no empty group or duplicate/invalid resource names, and exactly one resource/exclusive mode per group. Invalid partition means an execution error for that runner's selected targets and none of its groups execute; valid runner groups can still execute as before. Group order follows returned order, with runner ID as stable cross-runner tie-breaker. Alternative—splitting by scenario or using `ResolvedTarget.data` in the core—would guess framework semantics; forcing a new API version would needlessly break existing runners.

The host invocation for `partition` receives the same context, options, abort signal and timeout treatment as `resolve`/`run`. No plugin needs to implement it unless it opts into fine-grained concurrency. Resource keys are a cooperative namespace across registered runners; plugin authors must use the same key for the same shared resource. If a project requires an external lock, it belongs in the runner/test infrastructure, not this in-process scheduler.

Only the returned partition is part of the `focused-spec` contract. How a runner derives group boundaries and shared-resource keys is its own decision: hard-coded knowledge, runner-owned config, framework metadata, or another source. A Vitest plugin could, for example, read rules from `.focused-spec/runners/vitest.config.yaml`; this path and format are illustrative, not required or interpreted by the core. The runner must not assert independence for targets whose dependencies it cannot establish: return an exclusive group for those targets or report an actionable error. Resource keys for the same shared resource must match across participating runners regardless of where their policies come from. Only the global `execution.maxConcurrentGroups` limit belongs in the core config.

### 4. Bounded scheduler at the core boundary

Add `execution.maxConcurrentGroups` to the version-2 top-level config as a positive integer, default **1**. When 1, keep one runner invocation at a time (same result semantics as now). Above 1, start at most that many groups, with non-overlapping resource sets; a legacy or explicitly exclusive group waits until all other groups finish and prevents new starts while active. Queue compatible work deterministically but permit bypassing a blocked group to avoid idle slots; do not promise start/completion order. Await every started invocation and preserve per-target diagnostics on errors; `runRunnerTargets` validates exact cardinality per group. Assemble final output in scenario/evidence order, independent of completion order. No fail-fast: unrelated selected evidence still executes, as now. Limits count runner-host invocations, not framework workers; document that nested worker pools need separate tuning. Alternative—global parallelism by runner ID only—cannot accelerate a single-runner project and can race over shared resources.

### 5. Proof and evaluation

Use isolated plugin fixtures with an externally observable active-invocation log/delay to demonstrate overlap of compatible groups, serialization of conflicts (including across runner IDs), exclusivity of legacy groups, and no execution after invalid partition. A resolving fixture counts calls through the CLI and proves strict validation of unselected scopes while selected targets execute once. Run an actual project example for CLI smoke; compare old/new phase durations on more than one repository before claiming a speedup. Do not require a project-specific Vitest scheduler or alter spec authoring syntax.
## Risks / Trade-offs

- [Misdeclared resources or inaccurate independence] → Default serial and legacy exclusive; participating runners are responsible for their own policy and declare unknown compatibility exclusive or fail. Tests exercise conflicts but cannot discover unknown external state.
- [Several runner hosts each spawn full framework worker pools] → Core bound limits hosts, not workers; guidance must include framework-specific worker caps, and benchmarks must measure CPU/memory.
- [Duplicate resolution removal changes scoped selection] → Select by document identity and scenario ID, preserve validation-vs-execution selection tests including revisions, duplicate evidence and `--scenario`.
- [Invalid partition runs partial work] → Gather and validate all partitions before starting any group; surface ERROR for the malformed runner's selected targets without executing its groups. Other runners still run.
- [Plugin startup overhead per group outweighs gain] → Opt-in timings and comparative measurement; no automatic group creation.
- [Timed-out/aborted child overlaps later groups briefly] → Preserve existing host timeout/termination semantics and await settlement before releasing its resource keys.

## Migration Plan

Existing configs and runner plugins continue working with serial execution and receive the single-resolution benefit. Projects that can prove independence use a runner providing `partition` and set `execution.maxConcurrentGroups > 1`; each runner determines its own policy source and participating runners coordinate resource keys. Reverting the core config limit to 1 restores serialized invocation without changing evidence or runner selectors. Update the public API, owning documentation, and distributed `focused-spec` agent skill alongside implementation; no scenario Markdown migration.

## Open Questions

None required to begin implementation. Benchmarks determine whether any project should enable a limit above 1; resource safety remains an explicit project decision, not an automatic inference.

## Observed verification

Two independent example projects were run through the built CLI with `--timings --json` after implementation (milliseconds, one local run each):

| Project / selection | Validation | Resolution | Execution | Total |
| --- | ---: | ---: | ---: | ---: |
| `examples/openspec` / baseline, Go + pytest | 4.14 | 1219.64 | 531.82 | 1760.55 |
| `examples/spec-kit` / `001-blocked-account`, pytest | 4.53 | 204.44 | 186.46 | 399.65 |

Both returned PASS. Resolution includes runner-host startup and each project's test discovery; execution includes external test commands and host overhead. These examples use legacy runners, so their execution remained serial. The timings identify distinct dominant phases; they are **not before/after benchmarks**, do not prove a speedup, and cannot be extrapolated to the reported ~100-second Vertumnus run. That full run was intentionally not repeated. The CLI smoke fixture did demonstrate two declared independent groups overlapping and a default serial run, but its synthetic delay is not a throughput benchmark.
