# Design

## Context

See `proposal.md` for motivation and the two capability deltas for behavior. Current independent SDKs live at `packages/sdk/typescript` and `packages/sdk/go`. Their language-native bank consumers each define the six canonical event-sourced account scenarios once and exercise the same real account through ordinary tests, demos, and optional focused-spec plugins. This change adds standalone Python and .NET SDKs with pytest/xUnit consumers; it adds no focused-spec plugins.

Python 3.13, `uv`, pytest installation, .NET SDK 9, xUnit restore, and NuGet restore were available during planning. The repository's existing full check is the npm/Vitest suite; language SDK checks will remain explicit independent commands.

## Goals / Non-Goals

**Goals:**
- Keep each SDK independently usable and free of focused-spec and test-framework runtime dependencies.
- Preserve exact comparison, declaration isolation, cleanup/error preservation, cancellation, and optional execution-local events in language-native APIs.
- Reuse one canonical six-scenario bank suite per language across pytest/xUnit, demos, and the SDK.
- Add isolated package-consumer checks and documented independent build/test/release commands.

**Non-Goals:**
- New Format API 2 or Runner API 1 plugins, Roslyn helpers, pytest runner behavior, xUnit discovery, or any change to focused-spec CLI/configuration/plugin contracts.
- Python dynamic module introspection, a universal cross-language scenario wire format, test-framework functionality inside either SDK, or package-managed toolchain installation.
- Changes to existing TypeScript/Go SDKs or bank examples.

## Decisions

1. **Mirror behavioral invariants, not declaration syntax.** Python exposes immutable scenario/suite declarations and callable drivers; .NET exposes generic typed scenario/suite/driver contracts. Validate identity and supported data before application preparation, isolate mutable inputs, compare structurally without JSON round-tripping, and preserve expected/actual mismatch snapshots. Python supports an explicit JSON-compatible data model; .NET preserves CLR runtime types and collection semantics.

2. **Treat cleanup as part of verification.** Driver operations use each language's normal synchronous/asynchronous conventions. After preparation succeeds, cleanup runs exactly once and is awaited; cancellation cannot turn matching data into success, and cleanup receives a release context without caller cancellation. Failed preparation leaves partial-resource ownership to the driver. Preserve both primary and cleanup failures.

3. **Make event observation optional and execution-local.** Emit ordered Given/When/Expect, valid Actual, and application-authored explanations only when an observer is supplied. Deliver independent payload snapshots. Events remain diagnostic and never determine pass status. Without an observer, retain no SDK event history and emit no SDK output.

4. **Use the native test frameworks directly.** pytest and xUnit remain consumer-owned dependencies. Ordinary wrappers call the SDK on each canonical scenario and fail when actual application output differs from Expect. No SDK-specific test runner or framework adapter is added.

5. **Separate package and runtime gates.** Python is independently built/installed as a Python distribution; .NET is an independently packed NuGet project. Root scripts expose each language's verification without making it an implicit dependency of core's npm build. Release documentation records each package/version gate separately from the existing npm suite.

6. **Keep canonical bank scenarios language-owned.** Add one Python suite and one C# suite, each covering the same six account outcomes. Each demo and ordinary test references that suite and the real implementation; controlled regression checks use disposable copies and restore behavior before final pass.

## Risks / Trade-offs

- [Python typing is not enforced at runtime like .NET generics] → Validate supported values and declaration fields at runtime while keeping annotations useful to static type checkers.
- [.NET default equality may not express exact nested structural semantics] → Implement explicit recursive comparison with runtime-type, order, and null/empty distinctions; do not use JSON serialization as the oracle.
- [More runtimes increase CI prerequisites] → Keep separate, documented commands and report Python/.NET checks independently; do not claim coverage when a toolchain is unavailable.
- [Two independent publication channels complicate release coordination] → Document PyPI and NuGet package builds/version checks separately; npm packages remain unchanged.

## Migration Plan

Additive only. Introduce both SDK packages, their canonical bank consumers and tests, then repository commands and docs. Consumers install the language SDK and select pytest/xUnit in their own project. No existing project configuration or focused-spec integration is migrated.
