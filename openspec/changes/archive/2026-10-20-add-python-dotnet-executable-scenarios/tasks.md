# Tasks

## 1. Python SDK
- [x] 1.1 Implement the independent Python SDK with declaration validation, exact comparison, isolated inputs, cleanup, cancellation, errors, and optional events; verify its pytest contract suite on Python 3.13.
- [x] 1.2 Add a clean Python package-consumer check and public SDK README/license; verify wheel build/install and the documented standalone example without focused-spec.

## 2. .NET SDK

- [x] 2.1 Implement the independent typed .NET SDK with exact structural equality, input isolation, cleanup, cancellation, mismatch details, and optional events; verify its xUnit contract suite on .NET 9.
- [x] 2.2 Pack and consume the SDK in a clean .NET project and document its public API; verify restore and execution without focused-spec references.

## 3. Native bank consumers

- [x] 3.1 Add the Python bank implementation, six canonical SDK scenarios, pytest tests, and readable demo; verify all six outcomes and that a disposable withdrawal-boundary regression fails pytest.
- [x] 3.2 Add the .NET bank implementation, six canonical SDK scenarios, xUnit tests, and readable demo; verify all six outcomes and that a disposable withdrawal-boundary regression fails xUnit.

## 4. Repository integration

- [x] 4.1 Add independent pytest and xUnit command paths without changing focused-spec configuration or core dependencies; verify both run from the repository workflow.
- [x] 4.2 Update SDK documentation, release instructions, guides, and documentation indexes; verify every documented command and relative link.
- [x] 4.3 Run both SDK suites, both bank consumers, `npm test`, strict OpenSpec specs, and existing focused-spec validation/run; report each command result separately.

