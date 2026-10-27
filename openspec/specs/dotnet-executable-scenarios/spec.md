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
The maintained C# bank example SHALL define its six Given/When/Expect outcomes once, exercise the real account implementation, and run through ordinary xUnit tests and a readable demo without requiring focused-spec configuration. Optional focused execution SHALL reuse the same typed declarations and driver without a Markdown companion or registry.

<!-- focused-spec:id=dotnet-example.bank -->
#### Scenario: .NET account behavior agrees across tests and demo
- **WHEN** xUnit and the readable demo exercise the six bank scenarios
- **THEN** all six outcomes pass and a controlled withdrawal-boundary regression fails the affected xUnit assertion

<!-- focused-spec:id=dotnet-example.cli-bank -->
#### Scenario: Typed bank behavior agrees with focused execution
- **WHEN** the CLI executes the same six typed scenarios and a disposable copy changes the full-balance withdrawal boundary
- **THEN** all six originally pass, the full-balance outcome fails through both xUnit and focused execution after the regression, and both paths pass after exact restoration

### Requirement: Optional .NET suite driver binding
.NET suites SHALL accept optional inert source-path and exported-driver metadata without changing standalone typed verification or adding a CLI dependency. Native CLI discovery SHALL require an explicit binding and SHALL NOT infer it from xUnit wrappers or run application code to find it.

<!-- focused-spec:id=dotnet-sdk.driver-binding -->
#### Scenario: Existing typed callers need no binding
- **WHEN** a .NET-only consumer verifies an existing suite without a binding and a bound suite with an explicitly supplied driver
- **THEN** both retain typed SDK comparison without loading focused-spec or xUnit

<!-- focused-spec:id=dotnet-format.binding-required -->
#### Scenario: Missing binding is not guessed
- **WHEN** a CLI-selected C# suite omits its driver binding
- **THEN** discovery diagnoses that source rather than guessing a driver or omitting the suite

### Requirement: Static C# native discovery
The .NET format SHALL report exact scenario IDs, names, and declaration lines from its documented C# suite grammar without loading consumer assemblies, evaluating MSBuild projects, restoring dependencies, running source generators, or executing initializers and assertions. Unsupported dynamic declarations SHALL produce source diagnostics rather than a misleading empty catalog.

<!-- focused-spec:id=dotnet-format.static-discovery -->
#### Scenario: Inspection cannot build or initialize the application
- **WHEN** list, show, syntax-only validation, and strict validation inspect supported C# sources beside a build target and initializer that would each write a sentinel
- **THEN** exact identities and source locations are available and neither sentinel is written

<!-- focused-spec:id=dotnet-format.dynamic-rejected -->
#### Scenario: Computed identity and conditional inventories fail visibly
- **WHEN** a discovered suite computes its ID or collection, duplicates an ID, omits Expect, or conditionally changes its declarations through preprocessor directives
- **THEN** discovery reports the offending location without compiling or evaluating the source

### Requirement: Direct .NET native enrollment
The .NET format SHALL derive one exact execution reference per scenario for the explicitly configured runner. The selector SHALL preserve the project-relative C# suite path and opaque ID independently of display name and declaration line. No Markdown companion or evidence registry SHALL be required.

<!-- focused-spec:id=dotnet-format.direct-enrollment -->
#### Scenario: C# owns the only behavioral declaration
- **WHEN** a consumer registers the .NET format and runner for its native suite
- **THEN** it can list, strictly validate, and execute those same scenarios without duplicating them in another specification or registry

### Requirement: Exact selected typed .NET execution
The .NET runner SHALL recheck selected identities and execute only requested scenarios through the existing typed SDK. CLR values SHALL remain native through application execution and comparison. Missing, renamed, ambiguous, or unreported targets SHALL NOT pass; a successful build or process exit alone SHALL NOT establish execution.

<!-- focused-spec:id=dotnet-runner.exact-selection -->
#### Scenario: Exact opaque ID selects one typed action
- **WHEN** one scenario with Unicode, quotes, and separators in its ID is selected beside an unselected scenario whose action would fail
- **THEN** only the selected action executes and its actual observation determines its status

<!-- focused-spec:id=dotnet-runner.native-comparison -->
#### Scenario: CLR distinctions cannot be erased by report serialization
- **WHEN** a selected action returns an observation with a different CLR type or null-versus-empty collection from Expect
- **THEN** execution fails under the SDK comparison even if both values could have similar JSON representations

<!-- focused-spec:id=dotnet-runner.stale-target -->
#### Scenario: Source change invalidates resolved identity
- **WHEN** the selected ID is removed or renamed after resolution
- **THEN** execution fails without selecting a different scenario or using stale compiled output as evidence

### Requirement: Contained .NET execution bindings
Suite, driver source, and explicitly selected project paths SHALL remain inside the consuming project after symlink resolution. Resolution SHALL diagnose unsafe, missing, or ambiguous bindings without building or loading consumer code. Execution SHALL treat builds, imports, and dependencies as trusted project code, not a sandbox.

<!-- focused-spec:id=dotnet-runner.containment -->
#### Scenario: Escaped source or project cannot be selected
- **WHEN** a bound driver or configured project resolves outside the consuming root through traversal or a symlink
- **THEN** strict validation rejects it without compiling or loading the escaped code

### Requirement: Bounded .NET execution and trustworthy reports
.NET helper and execution processes SHALL have bounded input, output, and lifetimes. Cancellation, timeout, build failure, crash, malformed report, duplicate result, or missing selected result SHALL NOT produce pass. Cleanup after successful preparation SHALL be awaited during cooperative termination; forced termination SHALL NOT claim guaranteed cleanup.

<!-- focused-spec:id=dotnet-runner.transport -->
#### Scenario: A successful build is not a result
- **WHEN** build or execution exits zero without a valid unique selected result, or application output imitates a success report
- **THEN** the selected scenario cannot pass

<!-- focused-spec:id=dotnet-runner.cancellation -->
#### Scenario: Cancellation bounds a hanging typed action
- **WHEN** a prepared .NET action is cancelled but does not finish cooperatively
- **THEN** execution settles nonpassing within the documented termination bound and owned processes do not remain running

### Requirement: .NET CLI execution context
.NET CLI results SHALL retain bounded ordered SDK observations and application explanations, including valid Actual on mismatch, through the existing portable event contract. Event projection SHALL NOT become the equality oracle or change status, and unsupported event values SHALL NOT fabricate observations or passing results.

<!-- focused-spec:id=dotnet-runner.events -->
#### Scenario: Typed mismatch retains real explanation
- **WHEN** the selected account action explains its decision and returns an incorrect typed observation
- **THEN** detailed and JSON output retain its explanation and expected/actual context while SDK comparison remains failed

### Requirement: Independent .NET plugin distribution
The .NET format and runner SHALL operate from separately packed npm packages containing their runtime helpers and public contracts, without checkout source access. Inspection SHALL require no parser download or restore. The NuGet SDK SHALL remain separate and SHALL NOT acquire a focused-spec, parser, or xUnit runtime dependency.

<!-- focused-spec:id=dotnet-distribution.plugins -->
#### Scenario: Distributed parser and runner work outside the checkout
- **WHEN** a disposable consumer installs the native SDK package and packed core, format, and runner packages, then inspects with networking unavailable
- **THEN** plugin documentation, discovery, and strict resolution work using distributed assets, and selected execution works after the consumer's normal project restore
