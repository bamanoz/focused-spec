# AGENTS.md

These instructions govern work in the `focused-spec` repository.

## Product boundary

`focused-spec` connects small behavioral scenarios to exact executable evidence. The product boundary is the CLI result and the behavior of project-local runner plugins. Keep the core language- and framework-agnostic.

- `src/` owns parsing, configuration, planning, runner isolation, validation, execution, and the public API.
- `skills/focused-spec/SKILL.md` owns the agent workflow for authoring scenarios and runners.
- `evals/` owns black-box agent evaluation harnesses and fixtures.
- `docs/` owns current documentation, with one authoritative owner per topic.
- `examples/` owns runnable examples; `test/` owns behavioral tests.

## Operating principles

- Correctness first; prefer small explicit changes over abstractions.
- Inspect the governing contract and an existing pattern before editing. Do not infer CLI, `npx skills`, runner, or OpenSpec behavior when a local contract or executable check can answer it.
- Preserve user work and unrelated repository changes. Do not reset, overwrite, or delete unrelated files.
- Use the repository's structured editing and file tools for source changes. Use shell commands for builds, tests, and short verification commands.
- Never claim a command, test, eval, or behavior passed unless it was actually observed.
- Finish the requested end-to-end behavior. Do not leave stubs, placeholders, fake fallbacks, or TODO implementations.
- Prefer clean cutovers: migrate callers and remove obsolete paths instead of adding compatibility aliases unless compatibility is explicitly required.

## Documentation contract

At the start of every task, reread `docs/README.md` and keep its progressive-disclosure map in working context. Before changing behavior, also read the owning page for the affected topic.

Documentation uses progressive disclosure:

1. `docs/README.md` gives the map and the shortest orientation.
2. `docs/concepts/` explains the model and boundaries.
3. `docs/guides/` explains common tasks.
4. `docs/reference/` records exact CLI, configuration, and API contracts.
5. `docs/development/` records implementation and verification workflows.

Every new or changed behavior must update its owning documentation in the same change. Every new, moved, renamed, or removed documentation page MUST update `docs/README.md` and the relevant nested section index in the same change. A page that is not reachable from `docs/README.md` through the nested indexes is incomplete.

Before handoff, verify documentation links and the documentation tree. Do not claim documentation work complete while the map or an affected index is stale. Keep one normative owner per topic; link to it instead of duplicating prose. Root `README.md` is only the project entrypoint and quick start; detailed documentation belongs under `docs/`.

## TypeScript and package conventions

- Node.js 22.16.0+, strict TypeScript, NodeNext ESM, and erasable TypeScript syntax for runtime-loaded plugins.
- Relative TypeScript imports in source and plugins include the `.js` extension in emitted-runtime code; type-only imports use `import type`.
- Keep public contracts exported from `src/index.ts` or the declared `./runner` subpath.
- Preserve `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and strict diagnostics.
- Values crossing YAML, CLI, runner IPC, and JSON boundaries must remain JSON-compatible and be validated at the boundary.
- Runner modules are trusted project code, not security sandboxes. Still use executable/argument arrays, `shell: false`, bounded diagnostics, deterministic target IDs, and abort-aware child processes.

## Focused-spec invariants

- A scenario has one repository-unique lowercase dotted ID, exactly one `WHEN`, and one independently failing `THEN` outcome.
- Evidence is `<runner-id>::<opaque selector>`. Every selector resolves to exactly one target or one actionable error.
- Every resolved target produces exactly one `pass`, `fail`, or `skip` result. Never report `pass` without executing and interpreting the selected test.
- `run` performs strict validation first. `SKIP` and `ERROR` are not success unless the explicit CLI policy allows skips.
- OpenSpec `planned:` evidence is temporary and must be replaced before a completed change passes strict validation and execution.
- Preserve lexical and structural identity of selectors; do not silently normalize away user-authored evidence.

## Agent evaluations

The eval harness is black-box by design. An evaluated agent receives the installed package and public skill/API, not this repository's implementation source.

- Keep eval workspaces isolated and disposable.
- Do not modify product code or product tests to make evidence pass.
- Do not inspect `focused-spec` implementation source or installed JavaScript implementation during an eval. Public declarations and README contracts are allowed.
- Project-local runners must execute the existing product tests; fake `pass` results are invalid.
- Integrity gates must detect protected-file changes, implementation inspection, and `shell: true`.
- Test both positive execution and controlled mutations that must fail.
- OpenSpec proposal turns are planning-only; apply turns implement and verify the change.

## Verification

Use the narrowest relevant check while iterating:

```sh
npm test
npm run smoke
npm run eval:agent -- --list
```

For permanent changes, run `npm test` and exercise the affected CLI or installer path. For runner changes, execute the real example or an isolated eval. For documentation-only changes, validate links and command examples without claiming runtime behavior that was not exercised.

A final handoff must state the files changed, the commands actually run, observed results, and any remaining limitation. Do not hide a timeout, skipped optional dependency, or model-specific eval result behind a green partial check.
