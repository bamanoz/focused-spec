# Repository workflow

## Change loop

1. Read `AGENTS.md`, `docs/README.md`, and the owning documentation page.
2. Inspect the existing contract and neighboring implementation.
3. Change the smallest module that owns the behavior.
4. Update the owning documentation in the same change.
5. Run the narrowest behavioral check, then `npm test`.
6. Report exact commands and observed results.

## Tests

- `npm run build` checks the package sources.
- `npm run typecheck:tests` checks test, example, and eval TypeScript.
- `npm test` runs build, typechecks, and Vitest.
- `npm run smoke` runs the real polyglot example.
- `node dist/cli.js validate --strict` and `node dist/cli.js run` check the repository's own [focused-spec baseline](../../openspec/specs/scenario-authoring/spec.md) using `.focused-spec/runners/vitest.ts` to discover and run exact Vitest tests.

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

OpenSpec owns this repository's proposal/apply/archive lifecycle; focused-spec consumes only the focused scenarios found at the explicit version-2 document layouts. Proposal workflows are planning-only. Do not edit product code, runner code, or configuration during proposal. Apply workflows implement the artifacts, add any required project-local runner or configuration, and replace every `planned:` reference when its exact test exists.

When a delta intentionally retains a baseline scenario ID, add `- **REVISES**: baseline` to that scenario. OpenSpec operation headings are native SDD prose and do not grant focused-spec ownership. OpenSpec itself remains responsible for validating the proposal and delta schema.

This repository's `.focused-spec/config.yaml` registers the project-local Vitest runner and explicitly maps OpenSpec baseline and named-scope documents. During planning, use `node dist/cli.js validate --scope <name>` without `--strict`; planned targets are not resolved or executed. Before syncing a completed delta into `openspec/specs/`, remove all `planned:` prefixes and run:

```sh
node dist/cli.js validate --scope <name> --strict
node dist/cli.js run --scope <name>
```

After archive, validate and run the baseline without `--scope`. The [configuration guide](../guides/configuration.md) owns document discovery and scenario authoring; the [CLI reference](../reference/cli.md) owns selection and result semantics. The [documentation map](../README.md) links all seven baseline capabilities.
