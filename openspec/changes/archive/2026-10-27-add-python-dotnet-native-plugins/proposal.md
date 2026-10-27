# Proposal

## Why

Python and .NET already have independent executable-scenario SDKs, but unlike JavaScript/TypeScript and Go their canonical suites cannot be discovered or executed directly by focused-spec. Python currently needs pytest wrappers for CLI evidence, while .NET needs a project runner; both languages should support the same optional native-code workflow without a second specification or evidence registry.

## What Changes

- Add `@focused-spec/format-scenarios-python` and `@focused-spec/runner-scenarios-python`, using static Python syntax discovery and exact execution through the existing Python SDK.
- Add `@focused-spec/format-scenarios-dotnet` and `@focused-spec/runner-scenarios-dotnet`, using static C# syntax discovery and typed execution through the existing .NET SDK.
- Add optional inert suite-to-driver metadata to the native SDKs. Existing SDK-only declarations and pytest/xUnit callers continue to work without Node, CLI plugins, or framework runtime dependencies.
- Support list/show, syntax-only and strict validation without importing consumer modules, building consumer projects, or running application initializers. Reject unsupported dynamic discovery explicitly.
- Derive exact `[suite-path, scenario-id]` execution references from native declarations; execute only selected SDK scenarios and retain bounded observations, explanations, mismatches, and real failures.
- Integrate all four packages into workspace builds, packed-consumer checks, public installed documentation, release inventories, and the Python/.NET bank examples and release specification gate.
- Update installed integration guidance and human-facing docs to advertise the new optional paths, preserving independent pytest/xUnit execution.

## Capabilities

### New Capabilities

None. Extend the existing language-owned capabilities rather than introduce parallel plugin-only specifications.

### Modified Capabilities

- `python-executable-scenarios`: optional driver binding, static discovery, direct enrollment, selected SDK execution, transport/lifetime safety, independent plugin distribution, and optional bank CLI execution.
- `dotnet-executable-scenarios`: optional driver binding, non-executing C# discovery, direct enrollment, typed selected execution, transport/lifetime safety, independent plugin distribution, and optional bank CLI execution.

## Impact

- Four new optional npm workspaces under `packages/formats/scenarios-{python,dotnet}/` and `packages/runners/scenarios-{python,dotnet}/`; existing Format API 2, Runner API 1 and version-5 configuration remain unchanged.
- Small additive metadata APIs in the Python and .NET SDKs; application comparison and cleanup remain native SDK responsibilities. Native SDK distribution remains separate from npm.
- Python 3.11+ and .NET SDK 9+ remain consumer-owned prerequisites. The .NET format packages its prebuilt parser and required parser assemblies; inspection does not restore or build consumer code. Core acquires no language runtime, parser, or test-framework dependency.
- Existing Python/.NET tests, demos, package-consumer evidence, build/staging/release wiring, package contracts, README and owning guides are updated together during apply.
- This change does not add a general-purpose xUnit/NUnit/MSTest runner, replace `runner-pytest`, publish packages, or move release tags. Direct SDK runners close the requested native-scenario gap without routing through framework wrappers.
