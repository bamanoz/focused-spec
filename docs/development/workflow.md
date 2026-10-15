# Repository workflow

## Change loop

This repository uses specification-driven development (SDD) with OpenSpec. For every product behavior change, create an OpenSpec change before implementation; editing `openspec/specs/` directly is not a substitute for the proposal, apply, sync, and archive workflow. Documentation-only corrections that do not change behavior may update their owning page directly.

1. Read `AGENTS.md`, `docs/README.md`, and the owning documentation page; inspect the existing contract and neighboring implementation. The repository root is a private npm workspace: core source/output live at `packages/core/src` and `packages/core/dist`, never root `src` or `dist`.
2. For a behavior change, write the OpenSpec proposal, delta specs, and tasks (plus design when needed) under `openspec/changes/<name>/`. Validate the change with `openspec validate <name> --strict` before implementing it.
3. Apply the tasks in the smallest workspace packages that own the behavior. Bind each changed native item to exact format-owned evidence; update owning documentation and affected tests in the same change.
4. Let OpenSpec or the native host own approved publication, movement, regeneration, archive, and removal. Keep explicit scope-local enrollments and unique native bindings for surviving outcomes, retire obsolete working enrollment when its documents leave discovery, then validate and run the final selection. The authoritative portable procedure is served from `guidance/workflow.md`; matching IDs do not infer evidence or behavior semantics.
5. Run the narrowest behavioral check, then `npm test` and the affected real CLI/example path. Strict focused-spec validation resolves evidence but does not execute it: run the selected scope to prove behavior.
6. Once implementation and evidence pass, sync the delta into `openspec/specs/`, validate the resulting specs with `openspec validate --specs --strict`, then archive the change. Do not present a direct master-spec edit as a completed OpenSpec change.
7. Report the exact commands and observed results.

## Tests

- `npm ci` installs the complete private workspace from its lockfile; do not install separately inside package directories.
- `npm run build` builds all eight packages in dependency order: `focused-spec`, four formats, then three runners. It stages root `README.md`, `LICENSE`, `skills/`, and `guidance/` into core and generates each official runner's `README.md` from `docs/guides/runners.md`, converting relative links to canonical repository URLs. Generated package copies are ignored; root assets, package-owned format READMEs, and the runner guide remain their authored owners.
- Every workspace package build replaces its owned `dist/` tree before compilation. Asset staging replaces only core's generated `skills/` and `guidance/` mirrors, so removed authored modules or assets cannot survive in a later tarball. Authored source, root assets and unrelated files are preserved.
  The core build marks `dist/cli.js` executable after TypeScript emits it, so the workspace-linked `npx focused-spec` works after every rebuild.
- `npm run typecheck:tests` checks test and eval TypeScript; examples consume the compiled official packages rather than copied runner source.
- Package-consumer framework fixtures reuse the root lockfile's verified external dependency graph, excluding workspace links; core and adapters still install from fresh tarballs with ordinary peer validation. Core-only fixtures remain independent of that framework graph.
- `npm test` runs build, typechecks, and Vitest.
- `npm run smoke` runs the real [OpenSpec example](../../examples/openspec/) with Go and pytest evidence.
- `npx focused-spec validate --strict` resolves the repository's own [focused-spec contract](../../openspec/specs/scenario-authoring/spec.md) across every discovered scope without executing tests. `npx focused-spec run` then performs strict validation and uses the registered `@focused-spec/runner-vitest` package to execute exact Vitest evidence.

The workspace-linked `npx focused-spec` is local and does not download because `focused-spec` is a root workspace dependency. Direct core execution, when needed for package debugging, is `node packages/core/dist/cli.js`; root `dist/cli.js` is obsolete.

The supported-runtime verification matrix runs the complete `npm test`, exact focused evidence, and `npm run smoke` on Node.js 22.16.0 with its bundled npm and on the current Node runtime. Do not add ambient `NODE_OPTIONS` or skip failing tests to certify compatibility. Core's `prepack` builds/stages normal tarballs; `npm pack --ignore-scripts` consumes prepared output without rebuilding shared assets, including on npm 10. Checkout installation keeps the root `prepare` build.

The POSIX interactive init check uses Python 3's standard-library PTY to exercise searchable multi-selection, focus/fallback rendering, pre-write review, preview/conflicts, cancellation and terminal restoration. The packed-consumer test also drives a real PTY. Install Python 3 before running that suite on macOS/Linux; the terminal checks are skipped on Windows, not certified there. Core CLI installation does not depend on Python.

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

OpenSpec owns this repository's proposal/apply/sync/archive lifecycle; focused-spec consumes its native items through version-5 layouts that explicitly select API-2 formats. Proposal workflows are planning-only: intended exact evidence belongs in design/tasks, not executable inline `EVIDENCE`, registry files, configuration, runners, product code, or tests. Apply performs authorized integration and replaces every `planned:` reference when its exact test exists.

Focused IDs are opaque and unique within each scope. A delta may retain the same ID as `current`, but each `(scope, ID)` occurrence must independently bind its item and evidence. Scopes are execution contexts rather than ownership or revision ancestry; OpenSpec operation headings and unsupported `REVISES` metadata create no evidence inheritance. OpenSpec remains responsible for native proposal and delta validation.

This repository's `.focused-spec/config.yaml` explicitly selects the registry format composed with `@focused-spec/format-markdown`, moves its capability-owned `.focused-spec/evidence/<capability>.yaml` pattern into that adapter's options, registers `@focused-spec/runner-vitest`, selects `openspec/specs/**/spec.md` as `current`, and captures active change names as scopes. If authorized integration already exists, planning can use `npx focused-spec validate --scope <name>` without `--strict`; missing integration is deferred to apply rather than created to validate a proposal. Before syncing a completed delta into `openspec/specs/`, remove every `planned:` prefix and run:

```sh
npx focused-spec validate --scope <name> --strict
npx focused-spec run --scope <name>
```

After archive, validate and run all discovered scopes without `--scope`. The [configuration guide](../guides/configuration.md) owns document discovery, format composition, and authoring syntax; the [CLI reference](../reference/cli.md) owns selection and result semantics. Portable review, approval, upgrade, lifecycle, and evidence-sensitivity procedures live only in package-owned guidance. The [documentation map](../README.md) links every capability.
