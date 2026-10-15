# Design

## Context

See proposal.md for motivation. The source runner launches `collect.ts` through a fresh Node process, which does not inherit Vitest's TypeScript transform. Node 22.16.0 requires explicit type stripping. npm 10.9.2's directory fetcher runs `prepare` even with `--ignore-scripts`, while npm 11 skips it. Core alone owns a workspace prepare hook; the root also builds the whole checkout on installation.

Fresh `vitest@4.1.11` installation fails inside npm's optional peer resolution on both Node 22.16.0 and 26.8.1. Selecting the already-installed Vite version alone does not help. Reusing the repository lockfile's external graph in a fresh consumer succeeds without disabling peer checks.

## Goals / Non-Goals

**Goals:** complete green suites and real CLI/example execution on minimum and current Node with unchanged consumer contracts.

**Non-Goals:** releases, package version bumps, lockfile/dependency upgrades, agent integration refresh, sync, or archive.

## Decisions

1. Let the existing collector-path resolver return its executable argument prefix. Prefer compiled `collect.js`; for source `collect.ts`, prepend `--experimental-strip-types` only when `process.features.typescript` is not enabled. Both discovery and execution use that prefix after the configured command arguments. No global NODE_OPTIONS and no change to exact task selection.
2. Move only core's package-level `prepare` to `prepack`. Keep root `prepare` and every `build` command unchanged. npm pack without script suppression still builds/stages core; npm pack with suppression uses already-prepared files on npm 10 and 11.
3. Seed only the four framework-consuming fixtures with a private lockfile containing the existing root lock's `node_modules/` entries except workspace links; its root is the consumer manifest. Keep all product packages installed from fresh tarballs and peer validation enabled. Ordinary core-only and integration fixtures remain unchanged. Consumer installs must read the seed lock rather than disable package-lock processing. This avoids a moving optional-peer solve without coupling the product to a Vite version or hiding runner behavior.

## Exact evidence and files

- `runner.official.source-runtime` in this change's runner delta binds through `.focused-spec/evidence/runner-protocol.yaml` to `vitest::test/runner.spec.ts::project Vitest evidence runner > selects an exact listed test and rejects a controlled failing test`.
- `distribution.package.script-free-pack` in this change's distribution delta binds through `.focused-spec/evidence/distribution.yaml` to a new `vitest::test/package.spec.ts::package distribution > packs prepared core output without rebuilding it when scripts are disabled`.
- Add those two entries under scope `fix-node-runtime-compatibility` during apply, retaining all existing scopes and references.
- Implementation owners: `packages/runner-vitest/src/index.ts`, `packages/core/package.json`, `test/package.spec.ts`. Owning docs: `docs/guides/runners.md`, `docs/development/workflow.md`, `docs/development/releasing.md`; index links do not change.
- No new runner, format, integration, dependency, or public API.

## Verification

Keep the existing source-runner failures as regression evidence and observe the new prepared-pack test fail before the lifecycle repair under npm 10.9.2. Run both exact focused outcomes after repair. In disposable copies, prove source-outcome sensitivity by corrupting reported selected outcomes and packing sensitivity by restoring the original core prepare lifecycle; restore the correct product and rerun. Removing the type-stripping prefix is a functional loading regression, not evidence of assertion sensitivity.

Run `npm test` sequentially with Node 22.16.0/npm 10.9.2 and the current Node 26.8.1/npm 11.19.0 toolchain, without NODE_OPTIONS. Also exercise strict focused validation and execution for all enrolled scopes (including CLI discovery and compatibility), and run `npm run smoke` on both runtimes. Check normal core packing still builds and stages assets, validate OpenSpec and documentation links, and remove owned temporary artifacts after all subprocesses settle.

## Risks / Trade-offs

- Source helper flags belong to the runner's Node command contract, after caller command arguments; custom wrappers must accept Node flags just as they accept the helper path.
- The fixture lock is a reproducible verification input, not proof about every future third-party release. Core-only installation remains unseeded; packed product code remains source-independent.
- Passing all exercised checks establishes the tested runtime/toolchain matrix, not a mathematical guarantee about all environments.
