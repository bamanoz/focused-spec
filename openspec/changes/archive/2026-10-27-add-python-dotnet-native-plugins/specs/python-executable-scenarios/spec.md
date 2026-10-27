# Spec Delta

## ADDED Requirements

### Requirement: Optional Python suite driver binding
Python suites SHALL accept optional inert source-path and exported-driver metadata without changing standalone verification or adding a CLI dependency. Native CLI discovery SHALL require an explicit binding and SHALL NOT infer it from pytest wrappers or execute a factory to find it.

<!-- focused-spec:id=python-sdk.driver-binding -->
#### Scenario: Standalone callers need no driver metadata
- **WHEN** a Python-only consumer verifies an existing suite without a binding and a bound suite with an explicitly supplied driver
- **THEN** both retain the same SDK comparison behavior without loading focused-spec or pytest

<!-- focused-spec:id=python-format.binding-required -->
#### Scenario: Missing binding is an actionable discovery error
- **WHEN** a CLI-selected Python suite omits its driver binding
- **THEN** discovery diagnoses that source instead of guessing a driver or omitting the suite

### Requirement: Static Python native discovery
The Python format SHALL report exact scenario IDs, names, and declaration lines from its documented literal suite grammar without importing consumer modules, drivers, or assertions. Unsupported dynamic declarations and invalid identities SHALL produce source diagnostics rather than execution or an empty passing catalog.

<!-- focused-spec:id=python-format.static-discovery -->
#### Scenario: Inspection cannot import consumer code
- **WHEN** list, show, syntax-only validation, and strict validation inspect a supported suite whose imports or driver initialization would write a sentinel
- **THEN** the exact scenarios and source locations are reported and the sentinel is not written

<!-- focused-spec:id=python-format.dynamic-rejected -->
#### Scenario: Computed declarations cannot disappear
- **WHEN** a discovered suite computes its ID or scenario collection, duplicates an ID, or omits Expect
- **THEN** discovery reports the offending source location without evaluating the declaration

### Requirement: Direct Python native enrollment
The Python format SHALL derive one exact execution reference per scenario for the explicitly configured runner. The selector SHALL preserve the project-relative suite path and opaque scenario ID independently of its display name and source line. No Markdown companion or evidence registry SHALL be required.

<!-- focused-spec:id=python-format.direct-enrollment -->
#### Scenario: Native Python is the sole behavioral source
- **WHEN** a consumer configures the Python format and runner for its native suite
- **THEN** the same scenarios can be listed, strictly validated, and executed without a second specification or evidence registry

### Requirement: Exact selected Python execution
The Python runner SHALL recheck selected identities and execute only requested scenarios through the Python SDK, preserving native type-aware comparison and synchronous or asynchronous driver support. Missing, renamed, ambiguous, or unreported targets SHALL NOT pass. A successful process exit alone SHALL NOT establish execution.

<!-- focused-spec:id=python-runner.exact-selection -->
#### Scenario: Opaque ID selects one application action
- **WHEN** an exact ID containing Unicode, quotes, and separators is selected beside an unselected scenario whose action would fail
- **THEN** only the selected action executes and its actual observation determines its result

<!-- focused-spec:id=python-runner.native-comparison -->
#### Scenario: Native type differences remain mismatches
- **WHEN** the selected driver returns a list where Expect contains a tuple, or an integer where Expect contains a boolean
- **THEN** execution fails under the SDK's native comparison rather than passing through JSON coercion

<!-- focused-spec:id=python-runner.stale-target -->
#### Scenario: Removed identity cannot run a replacement
- **WHEN** the selected ID is removed or renamed after resolution
- **THEN** execution reports a nonpassing result without substituting another scenario

### Requirement: Contained Python source and driver bindings
Suite and driver sources SHALL remain within the consuming project after symlink resolution. Resolution SHALL reject missing or unsafe bindings without importing them. Runtime imports and dependencies SHALL be treated as trusted consumer code, not a security sandbox.

<!-- focused-spec:id=python-runner.containment -->
#### Scenario: Symlinked driver cannot escape the project
- **WHEN** a selected suite binds a driver path that resolves outside the project
- **THEN** strict validation rejects it before that code executes

### Requirement: Bounded Python execution and trustworthy reports
Python helper processes SHALL have bounded input, output, and lifetimes. Cancellation, timeout, crashes, malformed reports, duplicate results, or missing selected results SHALL NOT produce pass. SDK cleanup SHALL be awaited after successful preparation when cooperative shutdown remains possible; forced termination SHALL NOT claim guaranteed cleanup.

<!-- focused-spec:id=python-runner.transport -->
#### Scenario: Process exit is not a selected result
- **WHEN** a worker exits successfully without a valid unique result for its selected target, or application stdout resembles a success report
- **THEN** that output cannot establish a passing result

<!-- focused-spec:id=python-runner.cancellation -->
#### Scenario: Cancelled application cannot hang the runner
- **WHEN** a prepared Python action is cancelled and does not finish cooperatively
- **THEN** execution settles nonpassing within the documented termination bound and does not leave the owned worker running

### Requirement: Python CLI execution context
Python CLI results SHALL retain bounded ordered SDK observations and application explanations for selected execution, including valid Actual on mismatch. Serialization of report data SHALL NOT alter native comparison or status. Detailed and JSON output SHALL use the existing portable execution-event contract.

<!-- focused-spec:id=python-runner.events -->
#### Scenario: Real explanation and mismatch survive transport
- **WHEN** the selected account action explains its decision and returns an incorrect valid observation
- **THEN** CLI output retains the explanation and expected/actual context while the scenario remains failed

### Requirement: Independent Python plugin distribution
The Python format and runner SHALL operate from separately packed npm packages with their runtime helpers and public contracts, without checkout source access. The Python SDK SHALL remain a separate native distribution; neither core nor the SDK SHALL acquire a parser, CLI, or pytest dependency through this optional integration.

<!-- focused-spec:id=python-distribution.plugins -->
#### Scenario: Clean consumer uses only distributed assets
- **WHEN** a disposable consumer installs the Python SDK artifact and packed core, format, and runner packages
- **THEN** installed plugin documentation, discovery, strict validation, and selected execution work without source-checkout links

## MODIFIED Requirements

### Requirement: Python pytest bank consumer remains standalone
The maintained Python bank example SHALL define its six Given/When/Expect outcomes once, exercise the real Python account implementation, and run through ordinary pytest tests and a readable demo without requiring focused-spec configuration. Optional focused execution SHALL reuse the same declarations and driver without a Markdown companion or registry.

<!-- focused-spec:id=python-example.bank -->
#### Scenario: Python account behavior agrees across tests and demo
- **WHEN** pytest and the readable demo exercise the six bank scenarios
- **THEN** all six outcomes pass and a controlled withdrawal-boundary regression fails the affected pytest assertion

<!-- focused-spec:id=python-example.cli-bank -->
#### Scenario: Python account behavior agrees with focused execution
- **WHEN** the CLI executes the same six bank scenarios and a disposable copy changes the full-balance withdrawal boundary
- **THEN** all six originally pass, the full-balance outcome fails through both pytest and focused execution after the regression, and both paths pass after exact restoration
