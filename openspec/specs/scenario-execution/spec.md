# scenario-execution Specification

## Purpose

Selected evidence execution, status aggregation, and success policy.

## Requirements

### Requirement: Execution selection
`run` SHALL strictly validate and execute every discovered scope by default or only the scope named with `--scope`; with `--scenario <id>`, it SHALL strictly validate, resolve, and execute only occurrences of that ID in the selected scope(s). A requested scope with no matching documents or a selected ID absent from its scope selection SHALL fail before execution. Text and JSON results SHALL report the actual validation and execution selections, including the selected scenario when present. Every scenario result SHALL include its scope; multi-scope text output SHALL display the scope so repeated IDs are unambiguous.

#### Scenario: Default execution includes and distinguishes all scopes
- **ID**: `execution.selection.current`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs all scopes and disambiguates repeated scenario IDs`
- **WHEN** run is called without a scope name or scenario ID and multiple scopes contain valid revisions sharing one ID
- **THEN** every occurrence executes and its result identifies the owning scope

#### Scenario: Scope and scenario selection
- **ID**: `execution.selection.change-scenario`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports selected scope and scenario execution independently of validation scope`
- **WHEN** run selects one scenario inside one explicit scope
- **THEN** it validates and executes only that scenario and reports both selections

#### Scenario: Repeated ID selects every matching scope
- **ID**: `execution.selection.shared-id`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates and runs every matching scope for a selected scenario ID`
- **WHEN** run selects one scenario ID across multiple scopes without `--scope`
- **THEN** it strictly validates and executes each matching occurrence without executing other scenario IDs

#### Scenario: Missing selected scenario does not start execution
- **ID**: `execution.selection.missing-scenario`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a missing selected scenario before resolving evidence`
- **WHEN** run selects a scenario ID absent from its selected scope(s)
- **THEN** it reports the missing scenario and `executionStarted: false` without resolving other evidence or claiming PASS

#### Scenario: Missing selected scope does not start execution
- **ID**: `execution.selection.missing-scope`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > refuses to execute a named scope without documents`
- **WHEN** run explicitly selects a scope with no documents in the configured layout
- **THEN** it reports a missing-scope violation and `executionStarted: false` without claiming PASS

### Requirement: Evidence results and success policy
Each resolved target SHALL run once per unique runner/target pair and contribute its actual `PASS`, `FAIL`, `SKIP` or `ERROR` status to every scenario that cites it. A scenario SHALL pass only if all its evidence passes; skips are non-success unless the explicit `--allow-skip` policy applies.

#### Scenario: Shared target is executed only once
- **ID**: `execution.targets.shared`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > runs one shared target once for two scenarios`
- **WHEN** two scenarios refer to the same resolved runner target
- **THEN** the target executes once and both scenarios receive its result

#### Scenario: Skipped evidence is not relabelled PASS
- **ID**: `execution.status.skip-policy`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > does not claim skipped evidence as passing`
- **WHEN** a runner skips the only evidence and allow-skip is off or on
- **THEN** the scenario remains SKIP in both cases while only explicit allow-skip permits overall success

#### Scenario: Failing evidence makes the scenario fail
- **ID**: `execution.status.fail`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > propagates a failing target to the scenario and process result`
- **WHEN** a selected target fails its real test
- **THEN** the scenario is FAIL and run returns nonzero rather than claiming PASS

#### Scenario: Runner error cannot pass a scenario
- **ID**: `execution.status.error`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > reports runner execution errors without a false pass`
- **WHEN** runner execution throws or returns an invalid response
- **THEN** the affected scenario is ERROR and run is unsuccessful

#### Scenario: Empty execution is distinguishable from proof
- **ID**: `execution.status.empty`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** no documents match any configured layout and no scope was requested
- **THEN** run reports `executionStarted: false` and zero scenarios rather than claiming any PASS

### Requirement: Single strict resolution for run
`run` SHALL resolve concrete evidence for exactly its strict validation selection before any execution and derive the execution plan from those validated targets without resolving them again. With `--scenario`, only evidence from matching scenario instances in the selected scope(s) SHALL resolve; without it, the full selected scope(s) SHALL resolve. Selection SHALL distinguish document scope when IDs repeat, execute only selected unique runner/target pairs, and preserve validation errors from selected scenarios without requiring unrelated scenario evidence to resolve.

#### Scenario: Resolved targets are reused for selected scope
- **ID**: `execution.resolution.reuse`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reuses strict resolution for scoped execution without resolving twice`
- **WHEN** run selects one scope whose concrete evidence requires resolution
- **THEN** each runner resolves its selectors once and only targets from that scope execute

#### Scenario: Selected revision does not resolve source evidence
- **ID**: `execution.resolution.revised-id`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > executes revised evidence rather than source-scope evidence for the same scenario ID`
- **WHEN** a selected-scope revision shares its ID with a source scenario in an unselected scope
- **THEN** only the revision's evidence is resolved and executed while the source is inspected only for ownership

#### Scenario: Scenario filter narrows strict resolution
- **ID**: `execution.resolution.strict-unselected`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** run selects one scenario but concrete evidence in another scenario of the same scope cannot resolve
- **THEN** only selected evidence is resolved and executed; unrelated resolution errors do not block it

### Requirement: Opt-in phase timings
`validate` and `run` SHALL expose nonnegative elapsed wall-time durations for reached document validation, runner resolution and runner execution phases, plus total duration, when `--timings` is requested. Timings SHALL be present on validation failures for phases reached, and SHALL be absent from ordinary text and JSON output without the flag. Parallel phase durations SHALL NOT be presented as an additive estimate of total wall time.

#### Scenario: Timed run exposes actual phase durations
- **ID**: `execution.timings.opt-in`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports phase timings only when requested`
- **WHEN** a consumer runs the CLI with and without `--timings`
- **THEN** only the requested output includes measured phase durations without changing scenario results

#### Scenario: Failed validation retains reached timings
- **ID**: `execution.timings.failure`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports reached timings on validation failure`
- **WHEN** a timed run finds unresolved concrete evidence before execution
- **THEN** its failure output reports reached validation and resolution durations without claiming execution began

### Requirement: Compatible bounded execution
`run` SHALL default to serial runner invocation. If a positive project-wide concurrency limit greater than one is configured, `run` SHALL execute at most that many opted-in groups simultaneously, SHALL NOT overlap groups sharing a resource key, and SHALL run legacy or explicitly exclusive groups without overlapping any other group. It SHALL not infer compatibility from scenario or target identity and SHALL preserve one actual result per selected runner/target pair and deterministic scenario/evidence result order regardless of completion order. Group failure SHALL yield errors for its affected targets without falsely passing them or suppressing unrelated execution.

#### Scenario: Independent groups overlap within the limit
- **ID**: `execution.groups.independent`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > overlaps independent groups within the configured limit`
- **WHEN** a runner declares independent groups and concurrency greater than one is enabled
- **THEN** compatible groups overlap without exceeding the configured number of active runner invocations

#### Scenario: Shared resource serializes across runners
- **ID**: `execution.groups.conflict`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > serializes groups with a shared resource across runners`
- **WHEN** two opted-in runners declare the same resource key for selected groups
- **THEN** those groups never overlap while a compatible group may run alongside either one

#### Scenario: Failed group cannot pass its evidence
- **ID**: `execution.groups.failure`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > reports grouped runner failures without claiming evidence passed`
- **WHEN** one selected group's runner fails while another group executes
- **THEN** the failed group's targets report ERROR and the unrelated group's real result remains available
