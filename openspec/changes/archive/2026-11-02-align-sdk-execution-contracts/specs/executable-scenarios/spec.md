# Spec Delta

## MODIFIED Requirements

### Requirement: Actual execution and exact expectations
Execution SHALL prepare Given, perform When, await promises and compare Actual with Expect by exact structural equality. Driver mutation SHALL NOT rewrite Expect. Mismatches/application errors SHALL fail. The SDK SHALL snapshot validated Actual independently before cleanup and return it on success. Mismatches SHALL retain stable expected/actual snapshots and ID/name in typed assertion-compatible errors with useful comparison detail.

<!-- focused-spec:id=executable-sdk.actual-comparison -->
#### Scenario: Changed application behavior fails its specification
- **WHEN** an application emits a different event type or amount than the selected scenario expects
- **THEN** execution fails with expected and actual differences instead of accepting a successful function return

<!-- focused-spec:id=executable-sdk.input-isolation -->
#### Scenario: Driver mutation cannot alter the expectation
- **WHEN** a driver mutates the supplied Given or When data while producing an incorrect result
- **THEN** comparison still uses the original expectation and the reusable scenario declaration remains unchanged

<!-- focused-spec:id=executable-sdk.actual-snapshot-before-cleanup -->
#### Scenario: Cleanup cannot rewrite returned TypeScript actual
- **WHEN** a valid action returns its subject or a nested object and cleanup mutates that object after a matching comparison
- **THEN** verification returns the actual values as they existed before cleanup

<!-- focused-spec:id=executable-sdk.mismatch-snapshot -->
#### Scenario: Typed mismatch survives cleanup mutation
- **WHEN** a TypeScript action returns a valid incorrect observation and cleanup mutates the observation or expected source objects
- **THEN** the thrown assertion-compatible mismatch identifies the exact scenario and retains independent expected and actual snapshots plus comparison detail
