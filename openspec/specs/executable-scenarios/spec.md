# executable-scenarios Specification

## Purpose
Allow projects to author and execute concrete behavioral examples as code, independently of external specification frameworks, and optionally discover and run those same examples through focused-spec.

## Requirements

### Requirement: Independent scenario SDK
The JS/TS SDK `@focused-spec/scenarios-typescript` under `packages/sdk/typescript/` SHALL provide typed scenarios and execution without focused-spec, host or test frameworks. SDK source SHALL remain separate from integration packages. Future languages SHALL have their own SDK, format and runner implementations; this change SHALL implement only JS/TS.

<!-- focused-spec:id=executable-sdk.independent -->
#### Scenario: Execute a scenario without focused-spec
- **WHEN** a consumer installs only the packed SDK and executes a scenario against its application driver
- **THEN** the actual application result is compared with the expectation without loading focused-spec or requiring OpenSpec

### Requirement: Explicit scenario identity and data
A suite SHALL identify its application driver and scenarios. Every scenario SHALL declare one exact opaque nonblank control-free ID, a nonblank name, and JSON-compatible Given, When and Expect values. Duplicate IDs within one suite, missing fields and unsupported declaration fields SHALL be rejected without inventing defaults or silently omitting scenarios.

<!-- focused-spec:id=executable-sdk.invalid-declaration -->
#### Scenario: Invalid declarations cannot become passing scenarios
- **WHEN** a declaration duplicates an ID, omits Expect, or includes an unsupported field or non-JSON value
- **THEN** the declaration is rejected with an actionable error before application execution

### Requirement: Actual execution and exact expectations
Execution SHALL prepare the application from Given, perform When, and compare the actual result with Expect using exact structural equality. Promise-returning driver operations SHALL be awaited. Driver inputs SHALL be isolated from the declared expectation so application mutation cannot rewrite the expected result. Mismatches and application errors SHALL fail the scenario.

<!-- focused-spec:id=executable-sdk.actual-comparison -->
#### Scenario: Changed application behavior fails its specification
- **WHEN** an application emits a different event type or amount than the selected scenario expects
- **THEN** execution fails with expected and actual differences instead of accepting a successful function return

<!-- focused-spec:id=executable-sdk.input-isolation -->
#### Scenario: Driver mutation cannot alter the expectation
- **WHEN** a driver mutates the supplied Given or When data while producing an incorrect result
- **THEN** comparison still uses the original expectation and the reusable scenario declaration remains unchanged

### Requirement: Cleanup preserves execution failures
After successful preparation, execution SHALL await a provided cleanup operation exactly once on success or failure. Cleanup SHALL receive scenario identity and explanations without the caller's cancellation signal. Cleanup failure SHALL prevent success; simultaneous execution and cleanup failures SHALL remain available. A driver SHALL own resources partially acquired before preparation fails. Forced termination SHALL NOT guarantee cleanup.

<!-- focused-spec:id=executable-sdk.cleanup -->
#### Scenario: Failed execution still releases the prepared subject
- **WHEN** execution or comparison fails after preparation succeeds
- **THEN** cleanup runs once and its failure cannot hide the original failure or produce a passing result

<!-- focused-spec:id=executable-sdk.cleanup-cancellation -->
#### Scenario: Cancellation does not prohibit prepared-resource release
- **WHEN** the caller aborts after preparation succeeds and cleanup releases a real resource using the supplied context
- **THEN** cleanup receives no inherited abort signal, retains the same scenario ID and execution-local explanation channel, releases the resource once, and execution still rejects with cancellation
- **AND** If release also fails, `AggregateError.errors` SHALL retain both the primary cancellation reason and the cleanup error. Cleanup explanations SHALL remain in their real execution order and SHALL NOT manufacture an Actual observation for an aborted action.

<!-- focused-spec:id=executable-sdk.cleanup-awaited -->
#### Scenario: Verification waits for asynchronous release
- **WHEN** asynchronous cleanup has started after a completed action but has not yet finished
- **THEN** verification remains unsettled until release completes, and a release failure rejects verification rather than returning a passing observation
- **AND** Cleanup SHALL NOT inherit a cancellation that happens after cleanup starts. Drivers SHALL remain responsible for their own release bounds; the SDK SHALL NOT silently abandon release using an internal race or timeout.

<!-- focused-spec:id=executable-sdk.preparation-ownership -->
#### Scenario: Failed preparation retains partial-resource ownership
- **WHEN** preparation acquires part of its resources and then throws or rejects
- **THEN** the SDK does not invoke cleanup with an unprepared subject or run the action, and the original preparation failure remains observable while the driver owns partial-resource release

### Requirement: Static native scenario discovery
The JS/TS plugin `@focused-spec/format-scenarios-typescript` under `packages/formats/scenarios-typescript/` SHALL discover supported literal suites without importing modules or running application code. It SHALL expose exact scenario IDs, names and source lines and derive references for an explicitly configured runner. Unsupported dynamic declarations SHALL produce diagnostics, not disappear or execute.

<!-- focused-spec:id=executable-format.static-discovery -->
#### Scenario: Discover scenarios without loading application code
- **WHEN** focused-spec inspects a supported suite whose driver would have a visible side effect on import
- **THEN** it reports the scenarios and their real declaration locations without that side effect

<!-- focused-spec:id=executable-format.dynamic-rejected -->
#### Scenario: Dynamic scenario declarations are not guessed
- **WHEN** a selected source constructs its scenarios through function calls, spreads, imported values or computed properties instead of the supported literal declaration
- **THEN** discovery reports the unsupported construct without executing it or returning a misleading empty inventory

### Requirement: One native specification and automatic evidence
The code scenario SHALL remain the canonical specification. The optional format plugin SHALL enroll it directly with its own exact execution reference, without requiring a Markdown companion or evidence registry. IDs SHALL retain exact spelling independently of display names, and ordinary scope-local uniqueness rules SHALL continue to apply.

<!-- focused-spec:id=executable-format.direct-enrollment -->
#### Scenario: Code scenarios are the only specification source
- **WHEN** a project configures the scenario format and runner for a supported suite without any Markdown requirement or registry
- **THEN** focused-spec can inspect, strictly validate and execute its enrolled scenarios using their exact IDs

### Requirement: Exact direct scenario execution
The JS/TS runner `@focused-spec/runner-scenarios-typescript` under `packages/runners/scenarios-typescript/` SHALL resolve exact suite-path/ID selectors without importing drivers. It SHALL execute only selected scenarios through the JS/TS SDK and report actual outcomes. Missing, changed, ambiguous or unexecuted targets SHALL NOT pass; one failure SHALL NOT fabricate unrelated results.

<!-- focused-spec:id=executable-runner.exact-selection -->
#### Scenario: Unselected scenarios do not execute
- **WHEN** a run selects one passing scenario beside an unselected scenario that would fail or cause a side effect
- **THEN** only the selected scenario executes and its actual result is reported

<!-- focused-spec:id=executable-runner.missing-target -->
#### Scenario: A target disappears between resolution and execution
- **WHEN** a previously resolved scenario no longer exists at execution time
- **THEN** the target produces an actionable nonpassing result instead of an empty or synthetic success

### Requirement: Project-contained application drivers
The scenario runner SHALL resolve driver modules relative to the declaring suite within the selected project, verify canonical containment, and load them only during execution. Missing drivers, escaping paths, malformed exports and thrown driver errors SHALL be actionable nonpassing outcomes. JS and erasable TypeScript drivers SHALL run on the supported Node.js baseline without consumer-supplied runtime flags.

<!-- focused-spec:id=executable-runner.driver-boundary -->
#### Scenario: Driver cannot escape the consumer project
- **WHEN** a suite names a driver outside the project directly or through a symlink
- **THEN** validation or execution rejects the unsafe target without importing it

<!-- focused-spec:id=executable-runner.typescript-driver -->
#### Scenario: Consumer executes a TypeScript driver
- **WHEN** a consumer on Node.js 22.16.0 runs a selected scenario with an erasable TypeScript driver
- **THEN** the real driver executes without requiring the consumer to add a Node flag

### Requirement: Independently installed extension packages
The SDK, format and runner SHALL pack independently with runtime, declarations and docs in the role-based `packages/` layout. Relocated packages SHALL preserve npm names, exports, runner IDs, selectors and consumer configuration. Core SHALL NOT acquire the SDK or parser. Clean consumers SHALL run the SDK alone and optionally integrate through configuration version 5, Format API 2 and Runner API 1.

<!-- focused-spec:id=executable-distribution.consumer -->
#### Scenario: Packed extension operates outside the source checkout
- **WHEN** a clean consumer installs the SDK and optional plugin tarballs and follows their public contracts
- **THEN** standalone execution and focused-spec inspection, strict validation and selected execution work without repository source imports

### Requirement: Standalone bank demonstration remains usable
The sole maintained bank demo SHALL live in `examples/scenarios/`; its former external directory SHALL NOT be recreated. SDK migration SHALL preserve its six code-scenario outcomes against the real account. Standalone tests and readable output SHALL work without focused-spec configuration. Optional focused-spec execution SHALL use the same scenarios and expectations, not copies.

<!-- focused-spec:id=executable-example.bank -->
#### Scenario: Bank scenarios work standalone and through focused-spec
- **WHEN** the migrated bank example is exercised through its ordinary tests, readable demonstration and optional focused-spec runner
- **THEN** all six outcomes pass, and a controlled withdrawal-boundary regression fails the affected behavior in both standalone and focused-spec execution

### Requirement: Cooperative cancellation retains execution boundaries
The TypeScript SDK SHALL pass the caller's signal to preparation and action, reject a pre-aborted execution before preparation starts, and check cancellation before and after the action. Cancellation SHALL NOT become success merely because action returns matching data. After successful preparation, cancellation SHALL still follow the awaited cleanup and error-preservation contract.

<!-- focused-spec:id=executable-sdk.cancel-before-preparation -->
#### Scenario: Pre-aborted execution acquires no subject
- **WHEN** verification receives an already aborted signal
- **THEN** it rejects with the cancellation reason without invoking preparation, action or cleanup

<!-- focused-spec:id=executable-sdk.cancel-after-preparation -->
#### Scenario: Cancellation after preparation prevents the action
- **WHEN** preparation succeeds after the caller's signal has been aborted
- **THEN** the action is not invoked, cleanup releases the prepared resource once without the abort signal, and verification rejects with the cancellation reason

<!-- focused-spec:id=executable-sdk.cancel-after-action -->
#### Scenario: A matching action result cannot hide cancellation
- **WHEN** the caller aborts during an action that returns data equal to Expect
- **THEN** verification rejects with the cancellation reason, emits no Actual observation for that cancelled action, and awaits cleanup instead of reporting success
