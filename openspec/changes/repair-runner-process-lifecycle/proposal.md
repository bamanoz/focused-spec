# Proposal

## Why

Runner processes currently have inconsistent timeout cleanup, and several verified framework-specific failures can either leave tests running after cancellation or incorrectly reject valid execution. The current implementations also repeat process management, perform redundant Go discovery builds, contaminate consumer NuGet state, and require an experimental Node resolver flag.

## What Changes

- Centralize bounded subprocess capture and cross-platform process-tree termination for the relevant runner and format helpers.
- Ensure Go, Vitest, and pytest runners terminate their complete child process trees on cancellation, timeout, and output overflow.
- Preserve consumer NuGet configuration and assets when the .NET scenario runner builds its bridge.
- Make pytest outcomes correct when pytest-xdist is enabled through project configuration.
- Batch Go test discovery by package while retaining exact-one selector resolution.
- Exclude unused localized Roslyn satellite assemblies from the .NET scenario format package.
- Replace or remove reliance on Node's experimental parent-aware import-meta resolver while retaining consumer-local package resolution.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runner-protocol`: Official runners and process management must preserve bounded exact outcomes, clean up descendants, batch exact Go discovery, handle pytest-xdist, and retain consumer state during .NET execution.
- `dotnet-executable-scenarios`: .NET runner bridge compilation must not damage consumer NuGet configuration or assets.
- `distribution`: Packed .NET format output must omit unused localized Roslyn satellite resources.

## Impact

Runtime work spans `packages/runners/*`, `packages/formats/*` runtime helpers, the .NET scenario runner and format build configuration, and `packages/core` package resolution. A shared process helper may be exposed on the core runner public subpath. Runner behavior and package contents change without changing Runner API 1. Exact reproduction evidence and selectors are recorded in `design.md`. Updating npm source-only installation instructions is owned by the separate onboarding documentation proposal and is excluded here.