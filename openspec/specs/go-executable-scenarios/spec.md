# go-executable-scenarios Specification

## Purpose
Allow Go projects to own executable Given/When/Expect specifications independently of focused-spec and optionally inspect and execute those same native scenarios through explicit plugins.

## Requirements

### Requirement: Independent typed Go execution
The Go SDK SHALL provide typed scenario declarations and application drivers using only Go's standard library. Standalone execution SHALL require neither Node.js, focused-spec, OpenSpec nor a test framework.

<!-- focused-spec:id=go-sdk.independent -->
#### Scenario: A Go-only consumer executes its specification
- **WHEN** an isolated Go module depends only on the Go SDK and runs a scenario against its application
- **THEN** it observes the actual application result and a meaningful mismatch error without installing npm packages

### Requirement: Explicit validated scenario data
Scenarios SHALL have an exact nonblank control-free ID, nonblank name and explicit Given, When and Expect fields. Suites SHALL reject duplicate IDs. Unsupported data SHALL fail before preparing the application, rather than being silently dropped or converted.

<!-- focused-spec:id=go-sdk.invalid-declaration -->
#### Scenario: Invalid declarations cannot execute application code
- **WHEN** a suite duplicates an ID or a scenario contains an invalid identity or unsupported data
- **THEN** validation rejects it and application preparation does not run

### Requirement: Exact comparison with isolated inputs
Execution SHALL compare the actual observation with Expect using exact typed structural equality, including event order, amounts and nil-versus-empty collections. Driver mutation of Given or When SHALL NOT rewrite the declaration or expectation. A mismatch SHALL identify the scenario and expected and actual results.

<!-- focused-spec:id=go-sdk.comparison -->
#### Scenario: An incorrect application observation fails
- **WHEN** the application returns an event with an incorrect amount
- **THEN** the scenario fails with the expected and actual observations

<!-- focused-spec:id=go-sdk.input-isolation -->
#### Scenario: A mutating driver cannot rewrite its specification
- **WHEN** a driver mutates nested input data shared with the declared expectation and returns an incorrect observation
- **THEN** execution fails and the reusable declaration remains unchanged

### Requirement: Cleanup retains primary failure
After successful preparation, cleanup SHALL run exactly once after success, action failure, comparison failure or cancellation. Cleanup failure SHALL prevent success; simultaneous primary and cleanup errors SHALL remain individually discoverable. Failed preparation SHALL own any partially acquired resources.

<!-- focused-spec:id=go-sdk.cleanup -->
#### Scenario: Failed comparison and cleanup retain both errors
- **WHEN** comparison fails after preparation and cleanup also fails
- **THEN** cleanup runs once and the returned error preserves both failures

### Requirement: Cooperative context cancellation
A cancelled context SHALL prevent preparation. Cancellation after preparation SHALL reach the driver, prevent a passing result and permit cleanup with a usable cleanup context. Forced process termination SHALL NOT be presented as guaranteed cleanup.

<!-- focused-spec:id=go-sdk.cancellation -->
#### Scenario: Cancellation after preparation still releases resources
- **WHEN** a prepared action observes cancellation
- **THEN** execution is nonpassing and cleanup can release the subject despite the cancelled action context

### Requirement: Static Go native discovery
The Go format SHALL discover its documented literal declaration grammar without executing consumer packages, initializers, drivers or assertions. It SHALL expose exact IDs, names and declaration lines. Unsupported dynamic declarations SHALL produce source diagnostics instead of execution or a misleading empty inventory.

<!-- focused-spec:id=go-format.static-discovery -->
#### Scenario: Inspection leaves application initializers untouched
- **WHEN** list, show and strict validation inspect a supported suite whose application initializer has a visible side effect
- **THEN** they report its exact identities and source locations without that side effect

<!-- focused-spec:id=go-format.dynamic-rejected -->
#### Scenario: Computed scenarios cannot disappear from discovery
- **WHEN** a selected suite builds its scenario list or identity using executable expressions
- **THEN** discovery diagnoses the unsupported construct at its source without evaluating it

### Requirement: Direct enrollment from native Go scenarios
The Go format SHALL derive exact evidence for an explicitly configured runner directly from native scenarios. No Markdown companion or evidence registry SHALL be necessary. Exact opaque IDs SHALL remain independent of names and source lines, with existing scope-local uniqueness semantics unchanged.

<!-- focused-spec:id=go-format.direct-enrollment -->
#### Scenario: Native Go code is the sole consumer specification
- **WHEN** a consumer registers the Go format and runner with only supported Go scenario sources
- **THEN** it can list, strictly validate and execute those scenarios without a second behavioral document or registry

### Requirement: Exact selected execution
The Go runner SHALL execute only requested scenario IDs through the same SDK used by standalone callers. Missing, renamed, ambiguous or unreported targets SHALL NOT pass. A successful process exit alone SHALL NOT establish execution.

<!-- focused-spec:id=go-runner.exact-selection -->
#### Scenario: Opaque identity selects one action
- **WHEN** one scenario with punctuation and Unicode in its ID is selected beside another scenario whose action would fail or cause a side effect
- **THEN** only the selected action executes and its actual result determines its status

<!-- focused-spec:id=go-runner.missing-target -->
#### Scenario: A resolved target disappears
- **WHEN** the selected ID is removed after resolution
- **THEN** execution returns an actionable nonpassing result rather than running a replacement

<!-- focused-spec:id=go-runner.transport -->
#### Scenario: Successful exit with no selected report is not success
- **WHEN** the execution process exits without a valid report for a selected target
- **THEN** that target cannot receive a passing status

### Requirement: Contained source and driver bindings
Selected suite files and declared driver source files SHALL remain within the consumer project after symlink resolution. Inspection SHALL reject unsafe or missing bindings without loading consumer code. Execution SHALL treat application code and its dependencies as trusted Go code, not a sandbox.

<!-- focused-spec:id=go-runner.containment -->
#### Scenario: A driver source escapes through a symlink
- **WHEN** a suite names a driver source that resolves outside the project
- **THEN** resolution rejects it without running the escaped code

### Requirement: Independent distribution
The Go module and optional npm plugins SHALL operate outside this checkout using only their distributed assets and declared consumer prerequisites. The SDK SHALL remain independent of npm; plugin installation SHALL NOT require unpublished repository source or make core Go-aware.

<!-- focused-spec:id=go-distribution.consumer -->
#### Scenario: Clean consumers use distributed Go and plugin assets
- **WHEN** an isolated consumer installs the copied Go module distribution and packed plugins without source-checkout links
- **THEN** standalone execution, installed plugin documentation, inspection, strict validation and selected execution work

### Requirement: Language-separated bank consumers
The maintained examples SHALL reside in `examples/scenarios/typescript/` and `examples/scenarios/go/`. Each SHALL own the same six account outcomes and exact IDs, exercise a real account, and support ordinary tests, a readable demo and optional focused execution without duplicating scenarios in Markdown. Active callers SHALL use the new paths.

<!-- focused-spec:id=go-example.typescript-move -->
#### Scenario: Relocated TypeScript consumer remains executable
- **WHEN** its ordinary tests, readable demo and focused execution run from the new path
- **THEN** all six original outcomes remain available and a withdrawal-boundary regression fails standalone and focused execution

<!-- focused-spec:id=go-example.bank -->
#### Scenario: Go account agrees across execution paths
- **WHEN** Go tests, the readable demo and focused execution exercise the Go account
- **THEN** all six outcomes pass and a controlled withdrawal-boundary regression fails the full-balance withdrawal in standalone and focused execution
