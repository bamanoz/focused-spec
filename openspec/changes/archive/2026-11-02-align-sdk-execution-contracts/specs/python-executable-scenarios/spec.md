# Spec Delta

## MODIFIED Requirements

### Requirement: Exact Python structural comparison and isolation
Python SHALL prepare Given, execute When and compare Actual/Expect by exact type-aware structural equality. Mutation SHALL NOT rewrite declarations/Expect. Mismatches SHALL retain identity and stable expected/actual snapshots. Success SHALL return validated Actual snapshotted independently before cleanup. Sync SHALL work in active event loops and reject awaitables with async-use guidance and no coroutine warnings; async SHALL support awaitables.

<!-- focused-spec:id=python-sdk.comparison -->
#### Scenario: Python application regression fails exact expectation
- **WHEN** a driver returns an observation whose event field or amount differs from Expect
- **THEN** verification fails with the scenario identity and both the expected and actual observations

<!-- focused-spec:id=python-sdk.actual-snapshot-before-cleanup -->
#### Scenario: Cleanup cannot rewrite returned Python actual
- **WHEN** a valid synchronous or asynchronous action returns its subject or a nested object and cleanup mutates it after a matching comparison
- **THEN** verification returns the actual values as they existed before cleanup

<!-- focused-spec:id=python-sdk.sync-inside-running-loop -->
#### Scenario: Synchronous driver works inside a running event loop
- **WHEN** a caller invokes synchronous verification from within an active asyncio event loop and both driver operations are synchronous
- **THEN** verification completes synchronously with the actual result and does not create an unawaited coroutine

<!-- focused-spec:id=python-sdk.sync-rejects-awaitable -->
#### Scenario: Awaitable driver operation directs caller to async API
- **WHEN** synchronous verification encounters an awaitable driver operation
- **THEN** it fails with actionable guidance to use asynchronous verification and emits no unawaited-coroutine warning

### Requirement: Python cancellation is nonpassing
Cancellation SHALL NOT pass merely because the action returns matching data. Cleanup after successful preparation SHALL still run exactly once and be awaited. Cooperative scenario cancellation SHALL be reported as a normal nonpassing scenario error, not as asyncio task cancellation; actual task cancellation SHALL retain asyncio cancellation semantics and remain observable after cleanup.

<!-- focused-spec:id=python-sdk.cancellation -->
#### Scenario: Cancellation cannot become a matching pass
- **WHEN** cancellation occurs during an action that returns data matching Expect
- **THEN** verification reports cancellation as nonpassing and still awaits cleanup

<!-- focused-spec:id=python-sdk.cooperative-cancellation-is-error -->
#### Scenario: Cooperative cancellation remains visible to task groups
- **WHEN** the SDK's cooperative cancellation predicate stops a scenario running in an asyncio task group
- **THEN** the scenario raises a nonpassing ordinary exception and the task group observes the failure, while native task cancellation remains task cancellation

### Requirement: Execution-local Python observations and explanations
Python SHALL optionally emit ordered Given/When/Expect, valid Actual and application-authored events as independent snapshots. Explanations SHALL NOT determine status. Disabled observation SHALL preserve results/errors without SDK output or retained event state. Explanation message/data validation SHALL be observer-independent, without event-snapshot allocation/retention solely for disabled delivery. Explanation typing SHALL allow omitted data.

<!-- focused-spec:id=python-sdk.events -->
#### Scenario: Mismatch retains actual observations and real explanations
- **WHEN** an application emits an explanation and returns an incorrect valid observation while event capture is enabled
- **THEN** the caller receives the ordered declarations, explanation, and actual observation, while exact comparison still fails

<!-- focused-spec:id=python-sdk.explain-validation-without-observer -->
#### Scenario: Invalid explanation is rejected without observation
- **WHEN** a driver calls explanation with a blank message or unsupported structured data while no observer is configured
- **THEN** execution rejects the invalid explanation rather than silently accepting it, without retaining or emitting an event