# Tasks

## 0. Role-based package organization

- [x] 0.1 Move `packages/format-{markdown,gherkin,inline,registry}/` to `packages/formats/{markdown,gherkin,inline,registry}/` and `packages/runner-{vitest,pytest,go}/` to `packages/runners/{vitest,pytest,go}/`, keeping `packages/core/` and all existing npm names/public contracts unchanged. Set root workspace patterns to `packages/core`, `packages/sdk/*`, `packages/formats/*` and `packages/runners/*`. Update `package.json`, `package-lock.json`, moved package manifests/TypeScript configs, `scripts/build-package.mjs` and `scripts/stage-assets.mjs` as needed for nesting, all affected source/test imports and packing inventories (including `test/package.spec.ts`), `evals/evidence.ts`, `evals/provision.ts`, other active eval/example callers and authored documentation links. Preserve historical archives and immutable eval outputs. Remove obsolete directories/paths without aliases or copies; verify builds, typechecks, existing packed-consumer tests and CLI smoke behavior rather than source-layout assertions.

## 1. Independent language SDK

- [x] 1.1 Add the `packages/sdk/typescript/` workspace package `@focused-spec/scenarios-typescript` with compiled ESM, declarations and public `defineSuite`/`verifySpecification`/driver and scenario types. Extend the role-based root workspace build ordering without making core depend on it; verify the package builds and a packed SDK-only consumer imports it without focused-spec or parser dependencies. Do not create empty packages for future languages.
- [x] 1.2 Implement explicit suite validation, exact opaque identities, JSON-compatible data, awaited driver execution, input isolation, exact result comparison and cleanup/error preservation. Add the SDK behavioral cases named in design.md to `test/executable-scenarios.spec.ts`, document the standalone contract in `packages/sdk/typescript/README.md`, and verify the focused SDK cases including genuine mismatches and combined execution/cleanup failure.

## 2. Native code-scenario format

- [x] 2.1 Add `packages/formats/scenarios-typescript/` as `@focused-spec/format-scenarios-typescript` with Format API 2 and a public `./catalog` entry point. Implement static AST reading of the documented literal JS/TS suite grammar, real scenario source locations, shared SDK validation and JSON-tuple selectors; reject unsupported dynamic declarations without evaluating source. Add the format behavioral cases from design.md and verify actual side-effect-free discovery, invalid grammar errors and opaque ID round-tripping. This is a JS/TS parser, not a universal language parser.
- [x] 2.2 Implement direct format enrollment with the explicit `{ runner }` option and derived references, without a registry or Markdown companion. Document the complete grammar/options/selectors in the package README and the new format choice in `docs/guides/configuration.md` and `docs/concepts/README.md`; verify an isolated configured consumer's list/show/syntax-only inspection without importing a driver.

## 3. Exact scenario runner

- [x] 3.1 Add `packages/runners/scenarios-typescript/` as `@focused-spec/runner-scenarios-typescript` with Runner API 1. Resolve exact tuple selectors through the public JS/TS catalog, validate suite and driver canonical project containment without imports, and execute only selected current scenarios via the JS/TS SDK and default-exported project drivers. Implement the runner-owned worker with automatic erasable-TS startup support, bounded IPC, cancellation and owned-child termination. Add the runner behavioral cases from design.md; verify exact selection, removed targets, safe driver boundaries and honest nonpassing results.
- [x] 3.2 Extend `docs/guides/runners.md` and runner README staging with the direct scenario runner's selector, options, driver, cleanup and trust contracts. Verify JS and TypeScript drivers through the documented consumer commands, including an actual Node.js 22.16.0 run without consumer-supplied flags; confirm validation never executes the driver.

## 4. Existing repository-owned bank consumer

- [x] 4.1 Migrate the existing `examples/scenarios/package.json`, `examples/scenarios/src/account.mjs`, `examples/scenarios/specifications/account.driver.mjs`, `examples/scenarios/specifications/account.scenarios.mjs`, `examples/scenarios/test/account.node.mjs` and `examples/scenarios/demo.mjs` to `@focused-spec/scenarios-typescript` and the optional JS/TS plugins; add `examples/scenarios/.focused-spec/config.yaml`. Preserve the six bank outcomes and intervening user edits, register stable IDs and avoid duplicate prose or registry. Remove `examples/scenarios/lib/specification.mjs` only after all callers use the SDK. Add the bank behavioral check from design.md and update existing example links; verify standalone tests, readable output, list/show, strict validation and selected/full focused execution.
- [x] 4.2 Exercise a disposable clean consumer copied from `examples/scenarios/` against locally packed SDK and plugin packages; verify `npm test`, `npm start`, explicit local focused-spec inspection, strict validation and execution against the same six scenarios. Keep `examples/scenarios/` as the sole maintained demo, preserve its Node test entry point outside Vitest discovery, and do not recreate the former external bank directory or maintain a second copy.

## 5. Distribution and behavioral evidence

- [x] 5.1 Extend `scripts/stage-assets.mjs`, root package/build metadata, lockfile and affected package-consumer inventories in `test/package.spec.ts` for the SDK and optional JS/TS plugins at their final role-based locations. Add the packed extension consumer case from design.md. Update `docs/guides/install.md`, `docs/development/workflow.md` and `docs/development/releasing.md` for `packages/sdk/`, `packages/formats/`, `packages/runners/`, dependency order and additional tarballs without publication/version bumps. Verify SDK-only independence, core-only independence, preserved existing package consumers, plugin-docs provenance, public type imports and clean-consumer execution from all three extension tarballs.
- [x] 5.2 During apply, register all fourteen native outcomes in `.focused-spec/evidence/executable-scenarios.yaml` for scope `add-executable-scenario-sdk`, using the exact Vitest test names and references in design.md; preserve all other scope/source owners. Update `docs/README.md` and `docs/guides/README.md` with reachable links to the owning public contracts. Verify `openspec validate add-executable-scenario-sdk --strict`, local focused-spec strict validation and actual execution for this scope, plus documentation links and documented commands.

## 6. End-to-end acceptance

- [x] 6.1 Run `npm test`, the existing `npm run smoke`, standalone and focused bank paths, and packed-consumer checks on the current runtime; verify the new TS driver path on Node.js 22.16.0. In disposable copies introduce the real withdrawal-boundary regression, observe the expected behavioral assertion failures through both standalone and focused execution, restore it and observe PASS. Report exact observed results and any unchecked limitation; no publication, integration refresh or unrelated source changes.

## Workflow follow-up

- Review the completed implementation before any requested OpenSpec sync/archive; preserve exact identities and independently enrolled evidence through that separate lifecycle operation.
