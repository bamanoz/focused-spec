# Proposal

## Why

The TypeScript and Python SDKs can return an observation that cleanup has already mutated, unlike Go and .NET, and Python synchronous execution fails when called from an active event loop even with synchronous drivers. Across the four SDKs, typed mismatch details, explanation validation, suite bindings, and portable event behavior also diverge in ways that change consumer-visible outcomes or diagnostics.

## What Changes

- Capture and return an independent actual-observation snapshot before cleanup in TypeScript and Python, preserving that snapshot in successful results and typed mismatch diagnostics.
- Give TypeScript mismatches a typed error carrying scenario identity and stable expected/actual snapshots, while preserving the useful deep-difference diagnostic as its cause or equivalent detail.
- Make Python synchronous verification usable inside an active event loop when driver operations are synchronous; reject awaitable operations with an actionable error and no unawaited-coroutine warning. Make cooperative `ScenarioCancelled` an ordinary scenario failure, distinct from task cancellation.
- Validate explanation arguments consistently whether or not an observer is installed, while keeping event snapshot allocation and delivery disabled without an observer. Align Python's public explain typing with its optional data argument.
- Validate optional .NET `DriverBinding` metadata when validating a suite, and render mismatch values with stable structural content rather than runtime type names.
- Harmonize behavior-relevant SDK divergence: returned actual values and mismatch payloads are stable snapshots; mismatch errors carry scenario identity and both observations; explanation validation does not depend on observation; suite binding validation applies when metadata is supplied; cancellation and cleanup remain nonpassing and preserve primary/cleanup failures. Preserve language-specific data models, sync/async entry points, native typed equality, and established empty-suite rules unless a concrete consumer-visible inconsistency requires change.
- Define SDK divergence boundaries and exact evidence for behavior that remains intentionally language-specific.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `executable-scenarios`: TypeScript execution snapshots and typed mismatch behavior.
- `python-executable-scenarios`: synchronous execution in active loops, cooperative cancellation, stable actual snapshots, and public explanation typing.
- `go-executable-scenarios`: explanation validation independent of event sinks.
- `scenario-explanations`: explanation argument validity does not vary with observer configuration.
- `execution-events`: actual results and mismatch details retain pre-cleanup snapshots.
- `dotnet-executable-scenarios`: suite driver-binding validation and useful stable mismatch rendering.

## Impact

Runtime behavior and public API diagnostics in `packages/sdk/typescript/`, `packages/sdk/python/`, `packages/sdk/go/`, and `packages/sdk/dotnet/`; the corresponding existing capabilities and SDK documentation; and focused SDK regression evidence. Package metadata, `py.typed`, target frameworks, NuGet publication/install guidance, and Go module version metadata belong to the separate SDK distribution change. No CLI integration, runner implementation, or OpenSpec/Spec Kit integration changes are included.