---
name: focused-spec
description: MUST be used alongside any workflow that creates or changes behavioral specifications or scenarios, even when another skill owns that workflow. Enforces focused scenario IDs, executable evidence, on-demand configuration, and project-local runners.
---

# Focused Spec

Any behavioral specification authored in a project is a focused specification. Keep the surrounding framework's document structure, but write every behavioral scenario in the format below.

## Author a scenario

1. Find the single capability that owns the behavior; do not create a parallel formulation.
2. Protect the smallest product-boundary outcome that can fail independently.
3. Give the scenario one repository-unique lowercase dotted `ID` and preserve it when ownership moves.
4. Determine the execution environment, runner ID, and opaque selector shape before writing evidence.
5. Add one or more `EVIDENCE` rows. Multiple rows form an AND contract.
6. Write exactly one `WHEN` request and one independently failing `THEN` outcome.

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./internal/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Evidence is `[planned:]<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID. Use `planned:` only in a named scope while that exact test target does not exist; the runner ID, module path, and selector contract must already be chosen. Baseline evidence is always concrete. Remove every `planned:` before completing implementation.

When a named-scope scenario intentionally revises a baseline scenario, retain its ID and add exactly one explicit row:

```markdown
- **REVISES**: baseline
```

The baseline must own that ID. Never add `REVISES` to a baseline scenario or infer a revision from framework headings such as OpenSpec `MODIFIED Requirements`.

## Configure on demand

Create or update `.focused-spec/config.yaml` as soon as the first scenario names evidence. Keep runner modules in `.focused-spec/runners/`. Do not create root-level `focused-spec.yaml`.

Declare scenario-bearing Markdown with version-2 document layouts:

```yaml
version: 2
specifications:
  documents:
    - match: specs/**/*.md
      scope: baseline
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
runners:
  project-tests:
    module: ./.focused-spec/runners/project-tests.ts
    timeoutMs: 120000
```

Every document entry is either a baseline pattern with `scope: baseline` and no `{scope}`, or a named-scope pattern with exactly one `{scope}` and no `scope` property. Patterns and optional per-entry exclusions are project-relative and must remain inside the project. Each document must belong to one configured entry and scope. Scope names are path-safe fragments and are preserved exactly.

Use layouts that match focused scenarios, not arbitrary native SDD prose. The CLI does not interpret a framework's requirements format, infer evidence, add archive exclusions, or search fallback locations. When the native format cannot contain focused scenario blocks, configure an explicit companion Markdown document instead. A selected scope with no documents and any discovered named scope with no focused scenarios are errors; an empty baseline is valid.

`runners` is a map keyed by runner ID. Each entry requires `module`; optional fields are project-relative `cwd`, positive integer `timeoutMs`, and JSON-compatible `options`. `module` must be a project-contained `.ts`, `.mts`, `.js`, or `.mjs` file. Every runner ID referenced by evidence must be registered.

## Implement a runner

Import types only from `focused-spec/runner`. A default-exported `RunnerPlugin` has `apiVersion: 1`, `resolve(request)`, and `run(request)`.

- `resolve` receives `selectors`, `projectRoot`, resolved `cwd`, `runnerId`, JSON-compatible `options`, and abort `signal`.
- For every selector, `resolve` returns exactly one target `{ selector, targetId, displayName, source?, data? }` or one error `{ selector, message }`.
- Prove target existence through the real framework's collection/listing mechanism. Preserve the selector exactly and use deterministic target IDs.
- `run` receives resolved `targets` plus the same context and returns exactly one `{ targetId, status, diagnostic? }` per target.
- Status is `pass`, `fail`, or `skip`. Never return `pass` without executing and interpreting the selected test.
- Spawn tools with executable/argument arrays, `shell: false`, supplied `cwd`, and supplied `signal`. Keep diagnostics bounded.

The public shape is:

```ts
interface RunnerPlugin {
  readonly apiVersion: 1
  resolve(request: ResolveRequest): Promise<{ targets: ResolvedTarget[]; errors: ResolveError[] }>
  run(request: RunRequest): Promise<{ results: TargetResult[] }>
}
```

## Verify

While a named scope still contains `planned:` evidence, validate its structure with `focused-spec validate --scope <name> --syntax-only` and its configuration plus concrete evidence with `focused-spec validate --scope <name>` (without `--strict`). Planned targets are not resolved or executed; a successful planning check does not prove them.

Only after implementing the tests and runner, replace all `planned:` references with concrete selectors. Then verify the completed scope:

```sh
focused-spec validate --scope <name> --strict
focused-spec run --scope <name>
```

For the baseline, when all discovered named scopes are complete:

```sh
focused-spec validate
focused-spec run
```

Without `--scope`, validation covers the baseline and all discovered named scopes while execution selects the baseline. With `--scope`, both commands validate the baseline plus only the selected scope, and `run` executes that scope. `--scenario` narrows execution only. Never treat native SDD validation as a substitute for these focused checks, or vice versa.

Do not run `--strict` or `run` against a scope that intentionally still contains `planned:`; their failure is expected, not a proposal defect. Full validation resolves non-planned evidence; `run` performs strict validation and executes it. `SKIP` and `ERROR` are not success. Use `--allow-skip` only when explicit project policy permits unavailable optional evidence.
