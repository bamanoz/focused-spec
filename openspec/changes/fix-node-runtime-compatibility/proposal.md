# Proposal

## Why

The advertised Node.js 22.16.0 minimum does not pass the complete verification suite: source-mode Vitest helpers require explicit type stripping, npm 10 prepares shared outputs during supposedly script-free packing, and fresh framework resolution fails inside npm's peer resolver. Compatibility must be established on the minimum and current Node runtimes without global workaround flags or skipped checks.

## What Changes

- Run the Vitest runner's TypeScript helper on supported Node versions without consumer-supplied flags; keep compiled consumers unchanged.
- Build core for ordinary packing through `prepack`, while keeping checkout installation builds in the root `prepare`; script-free packing of prepared artifacts must not rebuild shared outputs.
- Make disposable package-consumer framework dependencies reproducible against the repository's verified framework toolchain, without disabling peer validation or changing consumer package contracts.
- Verify complete suites, packed consumers, exact CLI evidence, and real Go/pytest smoke on Node 22.16.0 with bundled npm and the current Node runtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runner-protocol`: source-mode official Vitest execution on the minimum supported Node version needs no ambient type-stripping flag.
- `distribution`: preparing a checkout and script-free packing of prepared output have distinct lifecycle boundaries.

## Impact

`packages/runner-vitest/src/index.ts`, `packages/core/package.json`, package-consumer tests, capability-owned evidence, runner/repository documentation, and this change's planning artifacts. No package version, public API, selector, dependency lockfile, agent integration, release, sync, or archive changes.
