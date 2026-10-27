# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
