## Why

`run` resolves selected evidence again after strict validation has already resolved it, adding avoidable runner startup and discovery to every project. Execution is also serialized by runner, while the core has no contract for expressing which subsets are independently executable; speeding this up by guessing from scenario IDs or framework-specific paths risks races and false evidence.

## What Changes

- Resolve concrete evidence once for the full strict validation selection, then derive the execution selection from that validated plan without resolving the same targets again.
- Offer opt-in phase timings so consumers can distinguish validation/discovery, resolution and runner execution time without changing default CLI output.
- Extend the project-local runner contract with an optional way to partition selected targets into executable groups and declare shared resource keys and independence. Each runner decides how to obtain that policy—code, runner-owned configuration, or another project-specific source; core consumes only the declared partition. Unmodified runners remain one exclusive invocation.
- Introduce a bounded, opt-in core scheduler that runs only declared-compatible groups concurrently, maps each target result once to every referencing scenario, and preserves strict-before-execution and existing failure/skip semantics.
- Do not add `PARALLEL` to scenario Markdown. Do not infer independence from selector, scenario, path, framework or runner ID. Do not promise coordination with other `focused-spec` processes or external test commands.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runner-protocol`: Allow a runner to declare a validated partition of selected targets and its shared-resource conflicts without making existing plugins incompatible.
- `scenario-execution`: Reuse strict resolution for the selected execution plan; optionally report phase timings and schedule compatible target groups with a global concurrency bound while retaining exact result semantics.

## Impact

`src/cli.ts`, `src/planner.ts`, `src/executor.ts`, runner host/client and exported `focused-spec/runner` types; core config parsing for the opt-in global concurrency limit; focused CLI and runner integration tests; `docs/reference/cli.md`, `docs/reference/runner-api.md`, `docs/guides/configuration.md`, `docs/guides/runners.md`, and the distributed `skills/focused-spec/SKILL.md`. No runner-specific policy format or framework-specific implementation is required for legacy behavior or the single-resolution improvement. Public runner API gains optional functionality; default CLI JSON/text remains unchanged.
