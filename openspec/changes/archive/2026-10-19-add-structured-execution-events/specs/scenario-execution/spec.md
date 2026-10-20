# Scenario execution delta

## ADDED Requirements

### Requirement: Events remain attributable to executed evidence
Execution results SHALL retain a target's events inside each citing evidence result, not in an unqualified scenario-wide log. Target deduplication, evidence order, scope-local identity, AND aggregation and concurrent-group isolation SHALL remain unchanged. Referencing the same target from multiple scenarios SHALL NOT execute it again to obtain events.

<!-- focused-spec:id=execution.events.attribution -->
#### Scenario: Shared and independent evidence retain their own explanations
- **WHEN** two scenarios cite one shared target and one also cites an independent target with different events
- **THEN** the shared target executes once, its events appear under each citing reference and the independent target's events do not leak into unrelated evidence

### Requirement: Run results retain native scenario context
Each executed scenario result SHALL include its native name and source path and line alongside its exact ID and scope. This provenance SHALL come from the selected native item rather than the runner's display name, target location or evidence registry. Text and JSON output SHALL preserve this distinction.

<!-- focused-spec:id=execution.result.native-context -->
#### Scenario: Native context is not replaced by evidence provenance
- **WHEN** a scenario's native name and source differ from its target display name and test location
- **THEN** its run result identifies the native scenario and separately attributes the executed evidence without using the test location as the native source

### Requirement: Detailed and compact presentation share one result
The run-only `--details` option SHALL show available events for every evidence result in human output. Compact output SHALL show events for nonpassing evidence and omit passing-event detail. JSON SHALL include all retained events regardless of `--details`; using both flags SHALL remain valid. Display mode SHALL NOT change collection, selection, status, timings or execution count.

<!-- focused-spec:id=execution.events.presentation -->
#### Scenario: Detail is a presentation choice rather than another execution mode
- **WHEN** the same selection contains passing and failing evidence and is run in compact, detailed and JSON modes
- **THEN** all modes retain the same actual outcomes, JSON retains both targets' events, and human detail follows the requested mode without rerunning a target for display

### Requirement: Detailed output preserves strict preflight
Requesting event detail SHALL NOT execute a driver during help, validation, inspection or a failed run preflight. A rejected run SHALL retain the existing execution-not-started result without inventing observations, explanations or execution metadata for unexecuted scenarios.

<!-- focused-spec:id=execution.events.preflight -->
#### Scenario: Details do not turn unresolved evidence into an execution
- **WHEN** a detailed run cannot resolve selected evidence before execution
- **THEN** it reports that execution did not start, invokes no action and emits no synthetic execution events
