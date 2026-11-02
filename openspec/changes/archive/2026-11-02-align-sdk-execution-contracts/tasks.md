# Tasks

## 1. Stable actual results and mismatch diagnostics

- [x] 1.1 In the TypeScript SDK, snapshot validated actual before cleanup, return that snapshot, and add an exported assertion-compatible typed mismatch error with scenario identity and stable expected/actual snapshots; verify via focused tests that cleanup mutation cannot change return or error values and useful comparison detail remains available.
- [x] 1.2 In the Python SDK, snapshot validated actual before cleanup and return it; verify synchronous and asynchronous drivers preserve values despite cleanup mutation and mismatch snapshots remain stable.
- [x] 1.3 In the .NET SDK, validate supplied suite driver binding path/export metadata using the documented C# identifier contract and render stable structural mismatch values without user serialization hooks; verify invalid bindings fail before resolution and nested-value mismatches show distinct contents.

## 2. Python execution semantics

- [x] 2.1 Implement synchronous verification without creating a coroutine for synchronous drivers, including inside an active event loop; fail clearly for awaitable operations and dispose an unconsumed coroutine where applicable. Verify both outcomes with warning capture and an in-loop regression.
- [x] 2.2 Make cooperative `ScenarioCancelled` an ordinary exception while preserving native `asyncio.CancelledError` behavior and cleanup/error grouping; verify task-group visibility, task cancellation propagation, and cleanup on each path.
- [x] 2.3 Correct Python `DriverContext.explain` public typing to allow omitted data; verify an ordinary static type-checking example can call `explain(message)` without diagnostics.

## 3. Explanation contract consistency

- [x] 3.1 Validate TypeScript, Go, and Python explanation inputs independently of observer presence while retaining disabled-capture allocation behavior; verify invalid message/data fails in both observer configurations and valid no-observer calls produce no events or output.
- [x] 3.2 Update SDK runtime documentation for actual snapshot timing, typed mismatch diagnostics, Python sync/async and cancellation behavior, explain validation, binding validation, and retained language-specific contract boundaries; verify documented API signatures and guarantees match the implementation and divergence matrix.

## 4. Scoped contract verification

- [x] 4.1 Run focused SDK regression tests for each changed runtime contract and verify all modified scenarios have exact executable selectors documented in design.md under `## Exact evidence`; confirm these changes require no CLI, runner, or package-distribution modifications.