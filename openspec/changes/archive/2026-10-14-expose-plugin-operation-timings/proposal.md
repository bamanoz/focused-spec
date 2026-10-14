# Proposal

## Why

Phase totals identify slow resolution or validation but cannot attribute the time to a configured runner or an individual document parse. Agents need measured plugin-operation boundaries, workload counts and overlap information to choose what to profile rather than guess from a large phase percentage.

## What Changes

- Extend existing opt-in `validate` / `run --timings` output with per-invocation runner rows for resolve, partition and run, and format rows for each attempted document parse.
- Retain existing phase totals; include command-relative start offsets, elapsed wall time, operation outcome and applicable selector/target counts. Identify each parse by configured format ID, project-relative document path and scope; indicate the first call on a fresh format host.
- Preserve completed measurements on errors/timeouts, distinguish an operation returning normally from tests passing, and report only attempted operations without inventing work for excluded documents or dormant partition calls.
- Render attribution in text and JSON. Do not collect detailed rows without `--timings`, change plugin API version 1, require plugin-provided telemetry, change scheduling or add persistent caches.
- Keep subprocess internals explicitly outside these core measurements: the feature locates the slow plugin/operation, not the individual command inside arbitrary trusted plugin code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scenario-execution`: opt-in phase timings gain runner-operation and document-parse attribution with honest failure, cold-start and concurrency semantics.

## Impact

Core owners: `packages/core/src/cli.ts`, `sources.ts`, `format-client.ts`, `runner-client.ts`, `planner.ts` and `executor.ts`; an internal timing collector may be introduced if needed. The owning documentation is `docs/reference/cli.md`; existing behavioral tests and the capability-owned `.focused-spec/evidence/scenario-execution.yaml` are updated only during authorized implementation. Runner/format public contracts remain version 1. This proposal does not implement or publish the change, rewrite installed guidance, optimize runner discovery or modify executable evidence registries.
