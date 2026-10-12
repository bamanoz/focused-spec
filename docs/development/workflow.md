# Repository workflow

## Change loop

This repository uses specification-driven development (SDD) with OpenSpec. For every product behavior change, create an OpenSpec change before implementation; editing `openspec/specs/` directly is not a substitute for the proposal, apply, sync, and archive workflow. Documentation-only corrections that do not change behavior may update their owning page directly.

1. Read `AGENTS.md`, `docs/README.md`, and the owning documentation page; inspect the existing contract and neighboring implementation. The repository root is a private npm workspace: core source/output live at `packages/core/src` and `packages/core/dist`, never root `src` or `dist`.
2. For a behavior change, write the OpenSpec proposal, delta specs, and tasks (plus design when needed) under `openspec/changes/<name>/`. Validate the change with `openspec validate <name> --strict` before implementing it.
3. Apply the tasks in the smallest workspace packages that own the behavior. Bind each changed native item to exact registry evidence; update owning documentation and affected tests in the same change.
4. Let OpenSpec or the native host own approved publication, movement, regeneration, archive, and removal. Keep explicit scope-local registrations and unique native bindings for surviving outcomes, retire obsolete working registrations when their documents leave discovery, then validate and run the final selection. The authoritative offline procedure is served from `guidance/workflow.md`; matching IDs do not infer evidence or behavior semantics.
5. Run the narrowest behavioral check, then `npm test` and the affected real CLI/example path. Strict focused-spec validation resolves evidence but does not execute it: run the selected scope to prove behavior.
6. Once implementation and evidence pass, sync the delta into `openspec/specs/`, validate the resulting specs with `openspec validate --specs --strict`, then archive the change. Do not present a direct master-spec edit as a completed OpenSpec change.
7. Report the exact commands and observed results.

## Tests

- `npm ci` installs the complete private workspace from its lockfile; do not install separately inside package directories.
- `npm run build` builds `focused-spec` first, then every adapter package, and stages root `README.md`, `LICENSE`, `skills/`, and `guidance/` into `packages/core`. It also generates each official runner's `README.md` from `docs/guides/runners.md`, converting its relative links to canonical repository URLs. Generated package copies are ignored; the root assets and runner guide remain the only authored owners.
- `npm run typecheck:tests` checks test and eval TypeScript; examples consume the compiled official packages rather than copied runner source.
- `npm test` runs build, typechecks, and Vitest.
- `npm run smoke` runs the real [OpenSpec example](../../examples/openspec/) with Go and pytest evidence.
- `npx focused-spec validate --strict` resolves the repository's own [focused-spec contract](../../openspec/specs/scenario-authoring/spec.md) across every discovered scope without executing tests. `npx focused-spec run` then performs strict validation and uses the registered `@focused-spec/runner-vitest` package to execute exact Vitest evidence.

The workspace-linked `npx focused-spec` is local and does not download because `focused-spec` is a root workspace dependency. Direct core execution, when needed for package debugging, is `node packages/core/dist/cli.js`; root `dist/cli.js` is obsolete.

The POSIX interactive init check uses Python 3's standard-library PTY to exercise real selection, empty-input/Ctrl-C/EOF cancellation, and confirmed installation. Install Python 3 before running that suite on macOS/Linux; the terminal check is skipped on Windows, not certified there. Core CLI installation does not depend on Python.

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

OpenSpec owns this repository's proposal/apply/sync/archive lifecycle; focused-spec consumes native items through version-4 layouts that explicitly select the installed Markdown format adapter and binds them through configured evidence-registry files. Proposal workflows are planning-only: intended exact evidence belongs in design/tasks, not a new or revised executable registry, product code, plugin code, or configuration. Apply workflows implement the artifacts, add required package/module registrations, and replace every `planned:` reference when its exact test exists.

Focused IDs are unique within each scope. A delta may retain the same ID as `current`, but each `(scope, ID)` occurrence must bind its own native item and declare its own evidence. Scopes are execution contexts rather than ownership or revision ancestry; OpenSpec operation headings do not create evidence inheritance. OpenSpec remains responsible for validating proposal and delta schema.

This repository's `.focused-spec/config.yaml` registers `@focused-spec/format-markdown` and `@focused-spec/runner-vitest`, selects `openspec/specs/**/spec.md` as `current`, captures active change names as scopes, and explicitly connects capability-owned `.focused-spec/evidence/<capability>.yaml` shards. Together those files form one logical registry, with scope-local evidence separate from native documents. If authorized integration setup already exists, planning can use `npx focused-spec validate --scope <name>` without `--strict`; planned targets are not resolved or executed. Missing setup is deferred to apply, not created to validate a proposal. Before syncing a completed delta into `openspec/specs/`, remove all `planned:` prefixes and run:

```sh
npx focused-spec validate --scope <name> --strict
npx focused-spec run --scope <name>
```

After archive, validate and run all discovered scopes without `--scope`. The [configuration guide](../guides/configuration.md) owns document discovery and scenario authoring; the [CLI reference](../reference/cli.md) owns selection and result semantics. The [documentation map](../README.md) links every capability.
