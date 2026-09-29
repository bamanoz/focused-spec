# AGENTS.md

These instructions govern work in the `focused-spec` repository.

## Product boundary

`focused-spec` connects small behavioral scenarios to exact executable evidence. The product boundary is the CLI result and the behavior of project-local runner plugins. Keep the core language- and framework-agnostic.

- `src/` owns the CLI and public API; `evals/` owns black-box evaluations; `examples/` and `test/` own runnable examples and behavioral tests.
- `skills/focused-spec/SKILL.md` and its bundled references own the portable agent workflow. They must work without this repository's documentation or source.
- `docs/README.md` maps human-facing concepts, guides, references, and repository workflows. `openspec/specs/` records executable behavioral requirements, not agent procedures.

## Operating principles

- Correctness first; prefer small explicit changes over abstractions.
- Inspect the governing contract and an existing pattern before editing. Do not infer CLI, `npx skills`, runner, or OpenSpec behavior when a local contract or executable check can answer it.
- Preserve user work and unrelated repository changes. Do not reset, overwrite, or delete unrelated files.
- Use the repository's structured editing and file tools for source changes. Use shell commands for builds, tests, and short verification commands.
- Never claim a command, test, eval, or behavior passed unless it was actually observed.
- Finish the requested end-to-end behavior. Do not leave stubs, placeholders, fake fallbacks, or TODO implementations.
- Prefer clean cutovers: migrate callers and remove obsolete paths instead of adding compatibility aliases unless compatibility is explicitly required.

## Documentation contract

At the start of every task, read `docs/README.md` for topic ownership. Before changing behavior, read its owning page and the governing contract. Update the owning documentation with every new or changed behavior; do not duplicate the installed skill's agent procedure in repository docs.

For a new, moved, renamed, or removed documentation page, update `docs/README.md` and the relevant section index in the same change. Before handoff, verify documentation links and that each page is reachable through the indexes. Root `README.md` is only the entrypoint and quick start; detailed documentation belongs under `docs/`.

## TypeScript and package conventions

- Node.js 22.16.0+, strict TypeScript, NodeNext ESM, and erasable TypeScript syntax for runtime-loaded plugins.
- Relative TypeScript imports in source and plugins include the `.js` extension in emitted-runtime code; type-only imports use `import type`.
- Keep public contracts exported from `src/index.ts` or the declared `./runner` subpath.
- Preserve `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and strict diagnostics.
- Values crossing YAML, CLI, runner IPC, and JSON boundaries must remain JSON-compatible and be validated at the boundary.
- For runner work, follow the public [runner API](docs/reference/runner-api.md) and the [bundled runner workflow](skills/focused-spec/references/runners.md); runner modules are trusted project code, not security sandboxes.

## Product and evaluation contracts

Use the [concepts](docs/concepts/README.md), [CLI reference](docs/reference/cli.md), [runner API](docs/reference/runner-api.md), and [capability specs](docs/README.md#topic-ownership) for product behavior. Use the [installed skill](skills/focused-spec/SKILL.md) for scenario authoring and evidence checks; this repository's OpenSpec lifecycle belongs to the [development workflow](docs/development/workflow.md).

Agent evaluations are black-box: the evaluated agent receives the installed package and public skill/API, not this repository's implementation. Follow [agent evals](docs/development/agent-evals.md) for the cases and integrity gates; never inspect the implementation or change protected product tests during an eval.

## Verification

Use the narrowest relevant check while iterating; for permanent changes run `npm test` and exercise the affected CLI or installer path. For runner changes, execute the real example or an isolated eval. For documentation-only changes, validate links and command examples without claiming unexercised runtime behavior. The [development workflow](docs/development/workflow.md) owns the commands.

Report files changed, commands actually run, observed results, and any limitations. Do not hide a timeout, skipped optional dependency, or model-specific eval result behind a green partial check.
