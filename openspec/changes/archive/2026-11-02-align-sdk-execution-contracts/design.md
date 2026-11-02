# Design

## Context

See proposal.md for motivation. Current capability ownership is language-specific for executable scenario behavior (`executable-scenarios`, `python-executable-scenarios`, `go-executable-scenarios`, and `dotnet-executable-scenarios`) and shared for event/explanation semantics (`execution-events`, `scenario-explanations`). SDKs deliberately retain different native value models and entry points. This proposal aligns observable invariants without imposing JSON coercion or a cross-language runtime abstraction.

## Goals / Non-Goals

**Goals:**
- Return a stable pre-cleanup actual snapshot in TypeScript and Python and carry stable expected/actual snapshots in mismatch diagnostics.
- Make behavior-relevant validation and mismatch contracts predictable across SDKs while preserving each language's native semantics.
- Specify a Python sync path that can execute synchronous drivers inside an active loop and distinguishes cooperative cancellation from task cancellation.
- Define explicit, testable boundaries for intentionally divergent language behavior.

**Non-Goals:**
- Converge all SDKs on one equality model, collection/data representation, async API, or empty-suite policy.
- Change packaging, publishing, module metadata, target frameworks, CLI plugins, runner processes, or integration workflows.
- Treat event formatting as a comparison oracle or serialize native data through JSON to force parity.

## Decisions

### Snapshot at the validated observation boundary

After the driver action returns and the SDK validates the actual value, take the independent returned snapshot before cleanup can mutate the subject or returned object. Use the same snapshot as the successful return and mismatch `Actual`; mismatch `Expected` is likewise a stable snapshot. Compare against the original declaration, not a cleanup-mutated value or observer-owned event. Preserve current `Actual` event timing and isolation. The SDK's existing data-model clone mechanism is preferred over introducing a new serializer.

### Standardize diagnostic shape, preserve native error semantics

Each SDK mismatch remains its language-appropriate error type, but exposes exact scenario ID/name plus expected/actual values captured at comparison time. TypeScript adds a public typed mismatch error; retain Node's structural comparison detail as the nested cause (or equivalent surfaced diagnostic) instead of losing useful diffs. .NET's exception message must render deterministic structural values based on supported scenario data, not default object `ToString`; diagnostic rendering must not invoke user serialization hooks or influence equality.

### Validate explanations before optional delivery

All SDKs reject a blank/non-string message and invalid structured data consistently whether or not an observer exists. No observer still means no event allocation, snapshotting solely for delivery, retained event list, or SDK output. Python's typing must express the runtime-supported optional data parameter. Go keeps its documented panic-on-invalid-input style; other language-specific error mechanisms remain intact.

### Preserve distinct execution models

Python's synchronous entry point executes synchronous operations inline even inside an already-running loop. If an operation returns an awaitable, it fails with guidance to use the async entry point, closes/disposes a newly created coroutine when safely possible, and does not emit an unawaited-coroutine warning. Its cooperative cancellation signal raises an ordinary `Exception` subclass; native asyncio task cancellation remains `asyncio.CancelledError` and propagates with cleanup semantics intact.

Suite validation checks optional driver binding metadata when present, including .NET. Path and exported-symbol validation follow the language's established lexical rules; validation does not load, import, compile, or execute the binding. Keep currently intentional SDK differences unless they affect an invariant named above: Python and .NET reject empty suites while TypeScript and Go permit them; native equality and accepted values differ; Go/Python/.NET carry explicit bindings in their own forms while TypeScript's string binding remains required; API naming, async model, and event representation remain idiomatic.

## SDK Divergence Matrix

| Concern | Harmonized contract | Retained language-specific behavior |
|---|---|---|
| Actual result and mismatch | Independent pre-cleanup snapshot returned/retained; stable expected snapshot on mismatch | Native clone and equality implementation |
| Mismatch identity | Exact ID and name plus expected/actual diagnostics | Native error inheritance and chaining conventions |
| Explanation validation | Same validity regardless of observer; no observer means no event delivery/allocation | TypeScript/Python exceptions, Go panic, .NET exception |
| Driver binding | Validate supplied metadata before use; never load it while validating metadata | TS required string, Go binding, optional Python/.NET bindings and native lexical constraints |
| Empty suite | No new global policy; retain verified current behavior | TS/Go permit; Python/.NET reject |
| Values/equality | Events/diagnostics do not weaken or alter comparison | TS JSON strict structure; Go typed DeepEqual; Python type-aware native model; .NET structural CLR model |
| Sync/async and cancellation | Cancellation cannot pass; cleanup and primary errors remain observable | TS Promise + AbortSignal; Go context; Python sync/async + cooperative predicate; .NET ValueTask + CancellationToken |
| Events | Emitted data is isolated at emission; observation configuration cannot alter verification | Per-SDK event types and native values, subject to existing portable event specs |

### Binding and mismatch message safety

.NET suite validation SHALL reject malformed supplied binding metadata using the public contract already documented for C# driver exports. Mismatch formatting uses a deterministic recursive formatter compatible with values admitted by validation and cloning, handles nulls, sequences, dictionaries and object fields, and has a bounded/cycle-safe defensive behavior. It must not run arbitrary `ToString` or serializer implementations as a hidden second execution of user code. If a value cannot be rendered safely, use a stable type-marked placeholder while the exception's typed properties retain the original snapshots.

## Exact evidence

The SDK-local tests below protect the native runtime contracts. The capability-owned registry binds their exact executable Vitest wrappers under `align-sdk-execution-contracts`; each scope-local occurrence is explicit and every AND member is retained.

- TypeScript SDK: `packages/sdk/typescript/test/index.test.ts > TypeScript executable scenarios > cleanup mutation preserves actual result and mismatch snapshots`; `... > mismatch exposes typed scenario diagnostics and comparison detail`; `... > validates invalid explanations with observer=true`; `... > validates invalid explanations with observer=false`; `... > keeps valid explanations silent without an observer`.
- Python SDK: `packages/sdk/python/tests/test_scenarios.py::test_actual_snapshot_precedes_cleanup`, `::test_async_actual_snapshot_precedes_cleanup`, `::test_sync_verification_inside_running_loop`, `::test_sync_verification_rejects_awaitables_without_warning`, `::test_cooperative_cancellation_is_task_group_failure`, `::test_native_task_cancellation_runs_cleanup`, `::test_explain_validates_without_observer`, and `::test_explain_data_is_optional`.
- Go SDK: `packages/sdk/go/scenarios_test.go::TestExplainValidatesWithoutEventSink`.
- .NET SDK: `packages/sdk/dotnet/FocusedSpec.Scenarios.Tests/UnitTest1.cs::ValidateRejectsInvalidDriverBinding` and `::MismatchMessageRendersStructuralValuesWithoutCallingToString`.

The public typing example is checked with `mypy --strict` by `vitest::test/python-scenarios.spec.ts::python executable scenarios > types the explanation data argument as optional`. Python runtime cases execute through their named wrappers in `test/python-scenarios.spec.ts`; Go through `test/go-executable-scenarios.spec.ts`; .NET through `test/dotnet-scenarios.spec.ts`. TypeScript tests are selected directly from `packages/sdk/typescript/test/index.test.ts`. These wrappers execute the SDK-local assertions; they do not replace native scenarios or require CLI plugins for SDK execution.

## Risks / Trade-offs

- Deep snapshots can allocate and may fail for unusual runtime objects; perform them once at the validated boundary and use existing SDK clone semantics. Preserve actual native values rather than forcing JSON conversion.
- A new TypeScript mismatch type is an additive public API change. Existing callers relying on generic AssertionError behavior should continue to receive an AssertionError-compatible error and comparable message detail.
- Python sync calls returning awaitables are inherently awkward inside an active loop; failing fast is preferable to nested-loop execution, blocking the loop, or silently leaking a coroutine.
- Structural .NET mismatch messages add formatting work and must avoid invoking arbitrary code. Typed exception properties remain the authoritative machine-readable contract.
- Do not revise distro docs or release/version fields in this change; the separately owned distribution change handles those concerns.