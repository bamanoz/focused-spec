# Spec Delta

## MODIFIED Requirements

### Requirement: Optional .NET suite driver binding
.NET suites SHALL accept optional inert source-path/exported-driver metadata without changing standalone typed verification or requiring CLI. CLI discovery SHALL require explicit binding, without inferring xUnit wrappers or executing application code. Before driver loading or execution, validation SHALL reject supplied blank/control-containing paths and exports that are not supported C# identifiers.

<!-- focused-spec:id=dotnet-sdk.driver-binding -->
#### Scenario: Existing typed callers need no binding
- **WHEN** a .NET-only consumer verifies an existing suite without a binding and a bound suite with an explicitly supplied driver
- **THEN** both retain typed SDK comparison without loading focused-spec or xUnit

<!-- focused-spec:id=dotnet-format.binding-required -->
#### Scenario: Missing binding is not guessed
- **WHEN** a CLI-selected C# suite omits its driver binding
- **THEN** discovery diagnoses that source rather than guessing a driver or omitting the suite

<!-- focused-spec:id=dotnet-sdk.validate-driver-binding -->
#### Scenario: Invalid optional binding fails suite validation
- **WHEN** a .NET suite supplies a driver binding with an empty or control-containing source path, or an invalid exported symbol
- **THEN** suite validation rejects the binding before driver resolution or application execution

### Requirement: Exact typed .NET comparison and isolation
.NET SHALL prepare Given, execute When and compare Actual with Expect by exact recursive structural equality, distinguishing runtime types, order and null versus empty collections. Driver mutation SHALL NOT rewrite declarations or expectations. Mismatches SHALL retain identity, expected/actual snapshots and deterministic structural messages, not runtime type names. Diagnostics SHALL NOT invoke serialization hooks or change comparison.

<!-- focused-spec:id=dotnet-sdk.comparison -->
#### Scenario: Runtime type or event regression fails typed expectation
- **WHEN** an application returns an event with a different field value or CLR type from Expect
- **THEN** verification fails with the scenario identity and stable expected and actual observations

<!-- focused-spec:id=dotnet-sdk.structural-mismatch-rendering -->
#### Scenario: Mismatch message shows observation contents
- **WHEN** a .NET scenario expects and receives different values inside supported arrays, sequences, dictionaries, or data fields
- **THEN** the mismatch message visibly distinguishes expected from actual contents, remains stable after cleanup mutation, and retains the typed snapshot properties