# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
