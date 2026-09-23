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

Tests protect observable behavior: parser boundaries, configuration errors, runner resolution/execution, CLI status, isolation, and failure handling. Do not add tests that only assert source layout or incidental implementation details.

## OpenSpec

Proposal workflows are planning-only. Do not edit product code, runner code, or configuration during proposal. Apply workflows implement the artifacts, replace planned evidence, and finish with strict validation and change-scoped execution.
