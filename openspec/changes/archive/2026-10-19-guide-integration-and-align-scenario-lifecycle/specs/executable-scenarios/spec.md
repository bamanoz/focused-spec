# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
