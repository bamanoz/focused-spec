# scenario-execution Specification

## Purpose

Selected evidence execution, status aggregation, and success policy.

## Requirements

### Requirement: Execution selection
Run SHALL strictly validate and execute every discovered scope by default or only the explicitly selected scope; with --scenario, it SHALL select occurrences of that ID in the selected scopes.


<!-- focused-spec:id=execution.selection.current -->
#### Scenario: Default execution includes and distinguishes all scopes
- **WHEN** multiple scopes contain independent scenarios sharing one ID and run selects all scopes
- **THEN** every occurrence executes its own evidence and its result identifies its scope
- **AND** A requested scope with no matching documents or selected ID absent from its selection SHALL fail before execution. Results SHALL report actual validation and execution selections, and every scenario result SHALL include its scope so repeated IDs remain unambiguous. Same-ID occurrences SHALL execute their own explicit evidence without inheritance.

<!-- focused-spec:id=execution.selection.change-scenario -->
#### Scenario: Scope and scenario selection
- **WHEN** run selects one scenario inside one explicit scope
- **THEN** it validates and executes only that scenario and reports both selections

<!-- focused-spec:id=execution.selection.shared-id -->
#### Scenario: Repeated ID selects every matching scope
- **WHEN** run selects one scenario ID across multiple scopes without --scope
- **THEN** it validates and executes each matching occurrence without executing other IDs

<!-- focused-spec:id=execution.selection.missing-scenario -->
#### Scenario: Missing selected scenario does not start execution
- **WHEN** run selects a scenario ID absent from its selected scopes
- **THEN** it reports the missing scenario without resolving evidence or claiming PASS

<!-- focused-spec:id=execution.selection.missing-scope -->
#### Scenario: Missing selected scope does not start execution
- **WHEN** run explicitly selects a scope with no documents in the configured layout
- **THEN** it reports a missing-scope violation without starting execution or claiming PASS

### Requirement: Evidence results and success policy
Each resolved target SHALL run once per unique runner/target pair and contribute its actual `PASS`, `FAIL`, `SKIP` or `ERROR` status to every scenario that cites it. A scenario SHALL pass only if all its evidence passes; skips are non-success unless the explicit `--allow-skip` policy applies.

<!-- focused-spec:id=execution.targets.shared -->
#### Scenario: Shared target is executed only once
- **WHEN** two scenarios refer to the same resolved runner target
- **THEN** the target executes once and both scenarios receive its result

<!-- focused-spec:id=execution.status.skip-policy -->
#### Scenario: Skipped evidence is not relabelled PASS
- **WHEN** a runner skips the only evidence and allow-skip is off or on
- **THEN** the scenario remains SKIP in both cases while only explicit allow-skip permits overall success

<!-- focused-spec:id=execution.status.fail -->
#### Scenario: Failing evidence makes the scenario fail
- **WHEN** a selected target fails its real test
- **THEN** the scenario is FAIL and run returns nonzero rather than claiming PASS

<!-- focused-spec:id=execution.status.error -->
#### Scenario: Runner error cannot pass a scenario
- **WHEN** runner execution throws or returns an invalid response
- **THEN** the affected scenario is ERROR and run is unsuccessful

<!-- focused-spec:id=execution.status.empty -->
#### Scenario: Empty execution is distinguishable from proof
- **WHEN** no documents match any configured layout and no scope was requested
- **THEN** run reports `executionStarted: false` and zero scenarios rather than claiming any PASS

### Requirement: Single strict resolution for run
Run SHALL resolve concrete evidence for exactly its strict validation selection before execution and derive its execution plan from those validated targets without resolving them again. Selection SHALL distinguish document scope when IDs repeat, execute only selected unique runner/target pairs, and retain validation errors from selected scenarios without resolving unrelated evidence.

<!-- focused-spec:id=execution.resolution.reuse -->
#### Scenario: Resolved targets are reused for selected scope
- **WHEN** run selects one scope with concrete evidence
- **THEN** each runner resolves its selectors once and only targets from that scope execute

<!-- focused-spec:id=execution.resolution.scoped-id -->
#### Scenario: Same-ID scopes execute independently
- **WHEN** a selected scope shares an ID with an occurrence in another scope
- **THEN** only the selected scope's evidence resolves and executes without a dependency on the other occurrence

<!-- focused-spec:id=execution.resolution.strict-unselected -->
#### Scenario: Scenario filter narrows strict resolution
- **WHEN** concrete evidence in another scenario of the selected scope cannot resolve
- **THEN** only selected evidence resolves and executes

### Requirement: Opt-in phase timings
`validate` and `run` SHALL expose nonnegative elapsed wall-time durations for reached document validation, runner resolution and runner execution phases, plus total duration, when `--timings` is requested. Timings SHALL be present on validation failures for phases reached, and SHALL be absent from ordinary text and JSON output without the flag. Parallel phase durations SHALL NOT be presented as an additive estimate of total wall time.

<!-- focused-spec:id=execution.timings.opt-in -->
#### Scenario: Timed run exposes actual phase durations
- **WHEN** a consumer runs the CLI with and without `--timings`
- **THEN** only the requested output includes measured phase durations without changing scenario results

<!-- focused-spec:id=execution.timings.failure -->
#### Scenario: Failed validation retains reached timings
- **WHEN** a timed run finds unresolved concrete evidence before execution
- **THEN** its failure output reports reached validation and resolution durations without claiming execution began

### Requirement: Compatible bounded execution
`run` SHALL default to serial runner invocation.


<!-- focused-spec:id=execution.groups.independent -->
#### Scenario: Independent groups overlap within the limit
- **WHEN** a runner declares independent groups and concurrency greater than one is enabled
- **THEN** compatible groups overlap without exceeding the configured number of active runner invocations
- **AND** If a positive project-wide concurrency limit greater than one is configured, `run` SHALL execute at most that many opted-in groups simultaneously, SHALL NOT overlap groups sharing a resource key, and SHALL run legacy or explicitly exclusive groups without overlapping any other group. It SHALL not infer compatibility from scenario or target identity and SHALL preserve one actual result per selected runner/target pair and deterministic scenario/evidence result order regardless of completion order. Group failure SHALL yield errors for its affected targets without falsely passing them or suppressing unrelated execution.

<!-- focused-spec:id=execution.groups.conflict -->
#### Scenario: Shared resource serializes across runners
- **WHEN** two opted-in runners declare the same resource key for selected groups
- **THEN** those groups never overlap while a compatible group may run alongside either one

<!-- focused-spec:id=execution.groups.failure -->
#### Scenario: Failed group cannot pass its evidence
- **WHEN** one selected group's runner fails while another group executes
- **THEN** the failed group's targets report ERROR and the unrelated group's real result remains available
