# Proposal

## Why

focused-spec supports standalone executable specifications in TypeScript and Go, but Python and .NET projects cannot keep the same native scenario-and-expectation model without adopting another SDK. Add independent Python and .NET SDKs so each language can own executable specifications and run them through its standard pytest or xUnit test suite against the real application.

## What Changes

- Add an independent Python SDK for Given/When/Expect declarations, validation, exact comparison, input isolation, cleanup, cancellation, and optional execution events.
- Add an independent typed .NET SDK with the same behavioral guarantees while preserving CLR value types.
- Add maintained Python/pytest and C#/xUnit bank consumers. Each language's ordinary tests and readable demo reuse one six-scenario suite against the real account implementation.
- Add repository commands, package-consumer checks, release instructions, SDK documentation, and documentation-index entries for the new SDKs. No focused-spec format or runner plugins are introduced by this change.
- Keep Python, .NET, pytest, and xUnit consumer-owned; core and the existing plugin APIs remain unchanged.

## Capabilities

### New Capabilities
- `python-executable-scenarios`: Standalone Python scenario SDK and native pytest consumers.
- `dotnet-executable-scenarios`: Standalone typed .NET scenario SDK and native xUnit consumers.

### Modified Capabilities
- None.

## Impact

New independent SDK package roots under `packages/sdk/python` and `packages/sdk/dotnet`, maintained examples under `examples/scenarios/python` and `examples/scenarios/dotnet`, repository build/test commands, release documentation, and SDK/guides/documentation indexes. Existing TypeScript and Go SDKs, focused-spec formats/runners, CLI configuration, and runner protocols are unchanged.