## 1. Reuse strict evidence resolution

- [x] 1.1 Add CLI regressions for one resolve per runner, strict failure in an unselected scenario, and baseline-versus-named-scope revisions with `--scenario`.
- [x] 1.2 Project validated targets onto selected documents and scenarios in `src/planner.ts`, retaining target deduplication and an error for a missing selected scenario.
- [x] 1.3 Update `run` in `src/cli.ts` to consume that projection without a second runner resolve; exercise default, scoped and empty-baseline CLI paths.

## 2. Observe costs on demand

- [x] 2.1 Add `--timings` to validate/run with monotonic wall-time phase measurements and opt-in JSON/text reporting, including reached phases on validation failure.
- [x] 2.2 Add CLI checks for opt-in/default output, positive phase durations, unchanged results and no claimed execution on failed resolution.

## 3. Declare safe execution groups

- [x] 3.1 Add optional `partition` request/response types to `focused-spec/runner` and host/client invocation without changing `apiVersion: 1` or legacy `resolve`/`run` behavior.
- [x] 3.2 Validate partitions atomically against selected unique target IDs, exclusive mode and distinct nonempty resource keys; reject malformed/failed partitions as ERROR for that runner without starting its groups.
- [x] 3.3 Add `execution.maxConcurrentGroups` as a validated positive version-2 config setting defaulting to 1; at 1 do not invoke partition.
- [x] 3.4 Add project-local runner fixtures using their own partition policy (for example one in code and one from runner-owned configuration); exercise selected-target partitioning, unknown-compatibility exclusive behavior, malformed partitions, legacy exclusivity and zero partition calls in serial mode.

## 4. Schedule bounded compatible work

- [x] 4.1 Implement bounded execution in `src/executor.ts` with global resource-key exclusion, legacy and explicitly exclusive groups, deterministic result order, and no fail-fast for unrelated targets.
- [x] 4.2 Use observable delayed runner fixtures to verify actual compatible overlap, cross-runner resource exclusion, concurrency bound, legacy exclusivity, grouped errors and exact result cardinality.
- [x] 4.3 Smoke-test an opt-in multi-group run and a default serial run through the actual CLI; inspect reported results and timings without inferring speedups from synthetic delays.

## 5. Documentation and final verification

- [x] 5.1 Update `docs/reference/runner-api.md`, `docs/reference/cli.md`, `docs/guides/configuration.md` and `docs/guides/runners.md` with partition semantics, runner-controlled policy sources, exclusive fallback, resource responsibility, timing output and nested worker limits; preserve the documentation map.
- [x] 5.2 Replace planned evidence in this change with exact executable test selectors, run focused strict validation and execution for this change, then run `npm test`, `npm run smoke`, and documentation-link/tree checks.
- [x] 5.3 Compare real CLI phase timings on more than one project before claiming a speedup; document where time remains in external runners and any observed limitations.
- [x] 5.4 Update the distributed `skills/focused-spec/SKILL.md` for optional runner partitioning, global concurrency and timings; verify its CLI examples and inclusion in the npm package.
