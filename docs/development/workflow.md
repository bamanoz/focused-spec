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
- `node dist/cli.js validate --strict` and `node dist/cli.js run` check the repository's own [OpenSpec baseline](../../openspec/specs/scenario-authoring/spec.md) using `.focused-spec/runners/vitest.ts` to discover and run exact Vitest tests.

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

Proposal workflows are planning-only. Do not edit product code, runner code, or configuration during proposal. Apply workflows implement the artifacts, replace planned evidence, and finish with strict validation and change-scoped execution.

This repository's `.focused-spec/config.yaml` registers the project-local Vitest runner. Change-scoped strict validation and execution must pass before syncing a delta into `openspec/specs/`; after archive, current specs are validated and run without `--change`. The [documentation map](../README.md) links all seven baseline capabilities.
