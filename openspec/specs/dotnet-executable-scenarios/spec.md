# dotnet-executable-scenarios Specification

## Purpose

Provide .NET projects with a typed executable scenario SDK whose native scenarios run against the real application through ordinary xUnit tests.

## Requirements

### Requirement: Independent typed .NET scenario SDK
The .NET SDK SHALL declare and execute typed Given/When/Expect scenarios against an application without requiring focused-spec, OpenSpec, or xUnit. Scenario data and actual observations SHALL retain their declared CLR types.

<!-- focused-spec:id=dotnet-sdk.independent -->
#### Scenario: Execute typed .NET scenarios without framework dependencies
- **WHEN** a clean .NET consumer installs only the SDK and verifies a scenario against its application driver
- **THEN** the typed actual application result is compared with Expect without loading focused-spec, OpenSpec, or xUnit

### Requirement: Explicit .NET scenario identity and data
A .NET scenario SHALL require one exact nonblank control-free ID, a nonblank name, and explicit Given, When, and Expect values. A suite SHALL reject duplicate IDs, missing or extra declaration fields, cycles, and unsupported data before application preparation.

<!-- focused-spec:id=dotnet-sdk.invalid-declaration -->
#### Scenario: Invalid .NET declarations cannot execute application code
- **WHEN** a suite contains a duplicate ID, omits Expect, has an unsupported field, or contains cyclic or unsupported scenario data
- **THEN** suite validation reports the invalid declaration before invoking the driver

### Requirement: Exact typed .NET comparison and isolation
The .NET SDK SHALL prepare the application from Given, execute When, and compare the actual observation with Expect using exact recursive structural equality that distinguishes runtime types, collection order, and null-versus-empty collections. Mutating driver inputs SHALL NOT rewrite the reusable declaration or expectation. A mismatch SHALL retain scenario identity and expected/actual snapshots.

<!-- focused-spec:id=dotnet-sdk.comparison -->
#### Scenario: Runtime type or event regression fails typed expectation
- **WHEN** an application returns an event with a different field value or CLR type from Expect
- **THEN** verification fails with the scenario identity and stable expected and actual observations

### Requirement: .NET cleanup preserves primary failures
After successful preparation, optional synchronous or asynchronous cleanup SHALL run exactly once after success or failure. Cleanup failure SHALL prevent success and preserve a simultaneous primary failure. Failed preparation SHALL leave partial-resource cleanup to the driver.

<!-- focused-spec:id=dotnet-sdk.cleanup -->
#### Scenario: Failed .NET execution still releases the prepared subject
- **WHEN** comparison or action fails after preparation and cleanup also fails
- **THEN** cleanup runs once, verification remains nonpassing, and both failures remain individually discoverable

### Requirement: .NET cancellation is nonpassing
Cancellation SHALL NOT pass merely because the action returns matching data. Cleanup after successful preparation SHALL run exactly once and be awaited.

<!-- focused-spec:id=dotnet-sdk.cancellation -->
#### Scenario: Cancellation cannot become a matching pass
- **WHEN** the caller cancels during an action that returns an observation equal to Expect
- **THEN** verification reports cancellation as nonpassing and awaits cleanup

### Requirement: Execution-local .NET observations and explanations
The SDK SHALL optionally report ordered Given, When, Expect, valid Actual, and application-authored explanation events for one execution. Event payloads SHALL be independent snapshots. Disabling observation SHALL preserve ordinary result and error behavior without SDK output or retained event state. Explanations SHALL NOT determine verification status.

<!-- focused-spec:id=dotnet-sdk.events -->
#### Scenario: Mismatch retains actual observations and explanations
- **WHEN** an application emits an explanation and returns an incorrect valid observation while event capture is enabled
- **THEN** the caller receives ordered declarations, explanation, and actual observation while exact typed comparison still fails

### Requirement: .NET xUnit bank consumer remains standalone
The maintained C# bank example SHALL define its six Given/When/Expect outcomes once, exercise the real account implementation, and run through ordinary xUnit tests and a readable demo without focused-spec configuration. Test wrappers and demo SHALL reuse the same declarations.

<!-- focused-spec:id=dotnet-example.bank -->
#### Scenario: .NET account behavior agrees across tests and demo
- **WHEN** xUnit and the readable demo exercise the six bank scenarios
- **THEN** all six outcomes pass and a controlled withdrawal-boundary regression fails the affected xUnit assertion
