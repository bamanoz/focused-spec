# Proposal

## Why

Projects should be able to describe behavior as executable Given/When/Expect scenarios without maintaining a second Markdown specification or adopting OpenSpec. The independent bank demo already proves this approach; focused-spec needs an optional SDK and plugins to discover and execute those same native scenarios.

## What Changes

- Organize all publishable workspace packages by role: `packages/core/`, `packages/sdk/<language>/`, `packages/formats/<format>/` and `packages/runners/<runner>/`. Use singular `sdk`; move existing formats and runners into their role directories while preserving their npm names and public contracts. Remove obsolete source paths rather than adding compatibility shims.
- Add the dependency-free JavaScript/TypeScript package `@focused-spec/scenarios-typescript` under `packages/sdk/typescript/`. Other language SDKs belong under `packages/sdk/` only when implemented; do not create empty future packages.
- Provide explicit scenario/suite definitions, typed application drivers, exact result comparison, asynchronous execution, and reliable cleanup. The SDK runs independently of focused-spec and any test framework.
- Add `@focused-spec/format-scenarios-typescript` under `packages/formats/scenarios-typescript/` and `@focused-spec/runner-scenarios-typescript` under `packages/runners/scenarios-typescript/`, implementing existing Format API 2 and Runner API 1 without core special cases. These integrations are language-specific, not a universal parser or runtime for future language SDKs.
- Treat supported JS/TS scenario declarations as the native specification. Discover their stable IDs, names and actual source lines statically; automatically derive exact execution references instead of requiring a duplicate evidence registry.
- Execute selected scenarios through the same SDK used by ordinary tests; load application drivers only during execution, not inspection or validation.
- Migrate the existing repository-owned bank demo in `examples/scenarios/` to the SDK, retain its standalone `npm test` and `npm start`, and add optional focused-spec inspection/validation/execution. Keep its six outcomes and real account implementation; the former external demo has already been relocated and is not a second implementation target.
- Add public package contracts, documentation links, packed-consumer checks, and focused behavioral evidence for that same example and the extension packages.

## Capabilities

### New Capabilities

- `executable-scenarios`: Independent language SDKs beginning with JavaScript/TypeScript, native code-scenario discovery, exact direct execution, optional focused-spec integration, and consumer distribution.

### Modified Capabilities

None. The integration implements the existing plugin contracts. Existing formats, evidence ownership, CLI result shapes, scopes, and runner protocols remain unchanged.

## Impact

- New SDK workspace `packages/sdk/typescript/`; update npm workspace discovery, build order, asset staging, package inventories and release documentation for the role-based layout without making core depend on the SDK.
- Move the four existing `packages/format-*` directories to `packages/formats/*` and the three `packages/runner-*` directories to `packages/runners/*`; retain `packages/core/`. Migrate build/config paths, imports, lockfile workspace links, packaging/eval fixtures and documentation in one cutover, preserving existing package names, exports, selectors and consumer configuration.
- New optional plugin workspaces `packages/formats/scenarios-typescript/` and `packages/runners/scenarios-typescript/`. Static TS-aware parsing is a format-package dependency, not an SDK or core runtime dependency.
- Update the existing `examples/scenarios/` consumer and add `test/executable-scenarios.spec.ts`, with capability-owned `.focused-spec/evidence/executable-scenarios.yaml` added during apply only.
- Documentation owners: concepts, configuration, runners, installation, development workflow/releasing, and their existing indexes. Each new package ships its public contract.
- The bank demonstration has one permanent location, `examples/scenarios/`; preserve standalone operation and do not recreate its former external directory.
- No publication, version bump, additional language SDK, new test framework, arbitrary-code interpretation, retry engine, browser/database abstraction, or changes to unrelated tests or user work are needed for this change.
