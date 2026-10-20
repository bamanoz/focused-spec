# Spec Delta

## Purpose

Provide Python projects with an independent executable scenario SDK whose native scenarios run against the real application through ordinary pytest tests.

## ADDED Requirements

### Requirement: Independent Python scenario SDK
The Python SDK SHALL declare and execute Given/When/Expect scenarios against an application without requiring focused-spec, OpenSpec, or pytest. SDK values and driver outcomes SHALL remain Python-native.

<!-- focused-spec:id=python-sdk.independent -->
#### Scenario: Execute Python scenarios without framework dependencies
- **WHEN** a clean Python consumer installs only the SDK and verifies a scenario against its application driver
- **THEN** the actual application result is compared with Expect without importing focused-spec, OpenSpec, pytest, or another test framework

### Requirement: Explicit scenario identity and supported data
A Python scenario SHALL require one exact nonblank control-free ID, a nonblank name, and explicit Given, When, and Expect values. A suite SHALL reject duplicate IDs, missing or extra declaration fields, cycles, and values outside its documented data model before application preparation.

<!-- focused-spec:id=python-sdk.invalid-declaration -->
#### Scenario: Invalid declarations cannot execute application code
- **WHEN** a suite contains a duplicate ID, omits Expect, has an unsupported field, or contains cyclic or unsupported scenario data
- **THEN** suite validation reports the invalid declaration before invoking the driver

### Requirement: Exact Python structural comparison and isolation
The Python SDK SHALL prepare the application from Given, execute When, and compare the returned actual observation with Expect using exact type-aware structural equality. Mutating driver inputs or actual values SHALL NOT rewrite the reusable declaration or Expected value. A mismatch SHALL retain scenario identity and stable expected and actual snapshots.

<!-- focused-spec:id=python-sdk.comparison -->
#### Scenario: Python application regression fails exact expectation
- **WHEN** a driver returns an observation whose event field or amount differs from Expect
- **THEN** verification fails with the scenario identity and both the expected and actual observations

### Requirement: Python cleanup preserves primary failures
After successful preparation, optional cleanup SHALL run exactly once after success or failure. Cleanup failure SHALL prevent success and preserve a simultaneous primary failure. Failed preparation SHALL leave partial-resource cleanup to the driver.

<!-- focused-spec:id=python-sdk.cleanup -->
#### Scenario: Failed execution still releases Python application resources
- **WHEN** comparison or action fails after preparation and cleanup also fails
- **THEN** cleanup runs once, verification remains nonpassing, and both failures remain discoverable

### Requirement: Python cancellation is nonpassing
Cancellation SHALL NOT pass merely because the action returns matching data. Cleanup after successful preparation SHALL still run exactly once and be awaited.

<!-- focused-spec:id=python-sdk.cancellation -->
#### Scenario: Cancellation cannot become a matching pass
- **WHEN** the caller cancels during an action that returns an observation equal to Expect
- **THEN** verification reports cancellation as nonpassing and still awaits cleanup

### Requirement: Execution-local Python observations and explanations
The SDK SHALL optionally report ordered Given, When, Expect, valid Actual, and application-authored explanation events for one execution. Event payloads SHALL be independent snapshots. Disabling observation SHALL preserve ordinary result and error behavior without SDK output or retained event state. Explanations SHALL NOT determine verification status.

<!-- focused-spec:id=python-sdk.events -->
#### Scenario: Mismatch retains actual observations and real explanations
- **WHEN** an application emits an explanation and returns an incorrect valid observation while event capture is enabled
- **THEN** the caller receives the ordered declarations, explanation, and actual observation, while exact comparison still fails

### Requirement: Python pytest bank consumer remains standalone
The maintained Python bank example SHALL define its six Given/When/Expect outcomes once, exercise the real Python account implementation, and run through ordinary pytest tests and a readable demo without focused-spec configuration. Test wrappers and demo SHALL reuse the same declarations.

<!-- focused-spec:id=python-example.bank -->
#### Scenario: Python account behavior agrees across tests and demo
- **WHEN** pytest and the readable demo exercise the six bank scenarios
- **THEN** all six outcomes pass and a controlled withdrawal-boundary regression fails the affected pytest assertion
