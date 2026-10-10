# Repository workflow

## Change loop

This repository uses specification-driven development (SDD) with OpenSpec. For every product behavior change, create an OpenSpec change before implementation; editing `openspec/specs/` directly is not a substitute for the proposal, apply, sync, and archive workflow. Documentation-only corrections that do not change behavior may update their owning page directly.

1. Read `AGENTS.md`, `docs/README.md`, and the owning documentation page; inspect the existing contract and neighboring implementation.
2. For a behavior change, write the OpenSpec proposal, delta specs, and tasks (plus design when needed) under `openspec/changes/<name>/`. Validate the change with `openspec validate <name> --strict` before implementing it.
3. Apply the tasks in the smallest modules that own the behavior. Bind each changed native item to exact registry evidence; update owning documentation and affected tests in the same change.
4. Run the narrowest behavioral check, then `npm test` and the affected real CLI/example path. Strict focused-spec validation resolves evidence but does not execute it: run the selected scope to prove behavior.
5. Once implementation and evidence pass, sync the delta into `openspec/specs/`, validate the resulting specs with `openspec validate --specs --strict`, then archive the change. Do not present a direct master-spec edit as a completed OpenSpec change.
6. Report the exact commands and observed results.

## Tests

- `npm run build` checks the package sources.
- `npm run typecheck:tests` checks test, example, and eval TypeScript.
- `npm test` runs build, typechecks, and Vitest.
- `npm run smoke` runs the real [OpenSpec example](../../examples/openspec/) with Go and pytest evidence.
- `node dist/cli.js validate --strict` resolves the repository's own [focused-spec contract](../../openspec/specs/scenario-authoring/spec.md) across every discovered scope without executing tests. `node dist/cli.js run` then performs strict validation and uses `.focused-spec/runners/vitest.ts` to execute the exact Vitest evidence.

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

OpenSpec owns this repository's proposal/apply/sync/archive lifecycle; focused-spec consumes native items from explicit version-3 document layouts and binds them through `.focused-spec/evidence.yaml`. Proposal workflows are planning-only: intended exact evidence belongs in design/tasks, not a new or revised executable registry, product code, runner code, or configuration. Apply workflows implement the artifacts, add required project-local runners or configuration, and replace every `planned:` reference when its exact test exists.

Focused IDs are unique within each scope. A delta may retain the same ID as `current`, but each `(scope, ID)` occurrence must bind its own native item and declare its own evidence. Scopes are execution contexts rather than ownership or revision ancestry; OpenSpec operation headings do not create evidence inheritance. OpenSpec remains responsible for validating proposal and delta schema.

This repository's `.focused-spec/config.yaml` registers the project-local Vitest runner, selects `openspec/specs/**/spec.md` as `current`, and captures active change names as scopes. Its registry carries the evidence separately from those native documents. If authorized integration setup already exists, planning can use `node dist/cli.js validate --scope <name>` without `--strict`; planned targets are not resolved or executed. Missing setup is deferred to apply, not created to validate a proposal. Before syncing a completed delta into `openspec/specs/`, remove all `planned:` prefixes and run:

```sh
node dist/cli.js validate --scope <name> --strict
node dist/cli.js run --scope <name>
```

After archive, validate and run all discovered scopes without `--scope`. The [configuration guide](../guides/configuration.md) owns document discovery and scenario authoring; the [CLI reference](../reference/cli.md) owns selection and result semantics. The [documentation map](../README.md) links every capability.
