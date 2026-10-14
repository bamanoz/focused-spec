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
`validate` and `run` SHALL retain nonnegative wall-time durations for reached validation, resolution and execution phases plus total with `--timings`, adding per-call runner and format arrays only with that flag in text and JSON. Failed calls SHALL retain measurements without changing selection, results or scheduling. Overlapping durations SHALL NOT be additive total wall time.

<!-- focused-spec:id=execution.timings.opt-in -->
#### Scenario: Timed run exposes actual phase durations
- **WHEN** a consumer runs the CLI with and without `--timings`
- **THEN** only the requested output includes measured phase durations and runner/format attribution without changing scenario results

<!-- focused-spec:id=execution.timings.failure -->
#### Scenario: Failed validation retains reached timings
- **WHEN** a timed run finds unresolved concrete evidence before execution
- **THEN** its failure output reports reached validation and resolution durations and attempted resolution measurements without claiming execution began

### Requirement: Runner operation timing attribution
Timed output SHALL identify each attempted runner invocation by configured runner ID, operation, command-relative `startedMs`, elapsed `durationMs`, applicable input count and `outcome`. Offsets and durations SHALL be finite nonnegative milliseconds.

<!-- focused-spec:id=execution.timings.runner-attribution -->
#### Scenario: Distinct runners and selected workloads are identifiable
- **WHEN** a timed command selects evidence using multiple runners and a shared reference
- **THEN** each resolve invocation reports its runner ID and unique selected selector count, each actual run invocation reports its selected target count, and unselected runners have no row
- **AND** resolve rows SHALL use `selectorCount`; partition/run rows SHALL use `targetCount`; `runnerOperations` SHALL be empty when no runner operation was attempted
- **AND** validation-only and syntax-only commands SHALL NOT report execution operations; dormant partitioning SHALL NOT produce a partition row
- **AND** text SHALL expose the same operation identities, counts, elapsed durations and outcomes as JSON

### Requirement: Format parse timing attribution
Timed output SHALL identify each attempted document parse by configured format ID, project-relative `path`, `scope`, command-relative `startedMs`, elapsed `durationMs`, `outcome` and `coldStart`. A row SHALL measure the entire core-facing parse call, not pure parser CPU time.

<!-- focused-spec:id=execution.timings.format-attribution -->
#### Scenario: Slow document attribution distinguishes initial host startup
- **WHEN** a timed command parses multiple selected documents through a reused format host and excludes another document
- **THEN** each attempted parse reports the correct path, scope and format ID, only the first call on that host is marked cold, and the excluded document has no parse row
- **AND** the first request on a newly created format host SHALL have `coldStart: true`, reused-host calls SHALL have false, and `formatOperations` SHALL be empty when no parse was attempted
- **AND** durations SHALL include host startup where applicable, module initialization, IPC and response validation but SHALL exclude document reading and registry binding; they SHALL NOT be described as pure parsing or subprocess timings
- **AND** text SHALL expose the same document identity, cold-start information, elapsed duration and outcome as JSON

### Requirement: Timing outcomes preserve operation failures
A timed operation SHALL report `completed` for a valid returned response and `error` for thrown errors, timeouts, crashes or malformed responses. Partial output SHALL retain attempted failed-operation timing without fabricating unattempted work. Existing exit codes, violations and test statuses SHALL remain authoritative.

<!-- focused-spec:id=execution.timings.operation-errors -->
#### Scenario: Failed calls remain diagnosable without relabelling test results
- **WHEN** format or runner calls fail, or valid responses report unresolved evidence or failing tests
- **THEN** output retains each attempted call with its measured outcome, distinguishes invocation errors from valid negative results, and omits every operation that never started
- **AND** a failed parse SHALL leave runner arrays empty when validation stops before resolution; a failed resolve SHALL have no run row; a completed run reporting a behavioral failure SHALL remain `outcome: completed` while its test and scenario remain FAIL
- **AND** valid responses reporting test FAIL/SKIP, unresolved selectors or native diagnostics SHALL remain completed operations rather than invocation errors

### Requirement: Timing intervals preserve concurrency meaning
Operation offsets SHALL use the same monotonic command origin as total timing. Run durations SHALL measure started invocations without including time waiting for scheduler admission. Each actual execution-group invocation SHALL have a separate row. Output arrays SHALL be sorted by start offset with deterministic identity tie-breakers, not completion order. Summing overlapping intervals SHALL NOT be presented as elapsed command time.

<!-- focused-spec:id=execution.timings.overlap -->
#### Scenario: Concurrent groups retain separate overlapping intervals
- **WHEN** a timed command executes compatible groups concurrently while another group waits for admission
- **THEN** the started groups have separate intervals showing overlap, the waiting group's interval starts only after admission, and group outcomes remain attributable regardless of completion order
- **AND** duration totals SHALL retain ordinary wall-time phase semantics rather than summing group durations

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
