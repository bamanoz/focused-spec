# Repository workflow

## Change loop

This repository uses specification-driven development (SDD) with OpenSpec. For every product behavior change, create an OpenSpec change before implementation; editing `openspec/specs/` directly is not a substitute for the proposal, apply, sync, and archive workflow. Documentation-only corrections that do not change behavior may update their owning page directly.

1. Read `AGENTS.md`, `docs/README.md`, and the owning documentation page; inspect the existing contract and neighboring implementation.
2. For a behavior change, write the OpenSpec proposal, delta specs, and tasks (plus design when needed) under `openspec/changes/<name>/`. Validate the change with `openspec validate <name> --strict` before implementing it.
3. Apply the tasks in the smallest modules that own the behavior. Keep focused scenarios tied to exact evidence; update the owning documentation and affected tests in the same change.
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

OpenSpec owns this repository's proposal/apply/sync/archive lifecycle; focused-spec consumes only the focused scenarios found at the explicit version-2 document layouts. Proposal workflows are planning-only. Do not edit product code, runner code, or configuration during proposal. Apply workflows implement the artifacts, add any required project-local runner or configuration, and replace every `planned:` reference when its exact test exists.

When a delta intentionally retains an ID from another scope, add `- **REVISES**: <source-scope>` naming a scope with that same ID. For this repository's active specs the source is normally `current`. OpenSpec operation headings are native SDD prose and do not grant focused-spec ownership. OpenSpec itself remains responsible for validating the proposal and delta schema.

This repository's `.focused-spec/config.yaml` registers the project-local Vitest runner, assigns `openspec/specs/**/spec.md` explicitly to `current`, and captures active change names as scopes. During planning, use `node dist/cli.js validate --scope <name>` without `--strict`; planned targets are not resolved or executed. Before syncing a completed delta into `openspec/specs/`, remove all `planned:` prefixes and run:

```sh
node dist/cli.js validate --scope <name> --strict
node dist/cli.js run --scope <name>
```

After archive, validate and run all discovered scopes without `--scope`. The [configuration guide](../guides/configuration.md) owns document discovery and scenario authoring; the [CLI reference](../reference/cli.md) owns selection and result semantics. The [documentation map](../README.md) links all seven capabilities.
