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

Evidence is `[planned:]<runner-id>::<opaque selector>`. Only the first `::` separates the runner ID. Use `planned:` only while that exact test target does not exist; the runner ID, module path, and selector contract must already be chosen. Remove every `planned:` before completing implementation.

## Configure on demand

Create or update `.focused-spec/config.yaml` as soon as the first scenario names evidence. Keep runner modules in `.focused-spec/runners/`. Do not create root-level `focused-spec.yaml`.

For Markdown files selected by glob:

```yaml
version: 1
specifications:
  source: files
  paths: [specs/**/*.md]
runners:
  project-tests:
    module: ./.focused-spec/runners/project-tests.ts
    timeoutMs: 120000
```

For a framework-managed source supported by the CLI, select it instead; for example:

```yaml
specifications:
  source: openspec
  root: openspec # optional; defaults to openspec
```

`runners` is a map keyed by runner ID. Each entry requires `module`; optional fields are project-relative `cwd`, positive integer `timeoutMs`, and JSON-compatible `options`. `module` must be a project-contained `.ts`, `.mts`, `.js`, or `.mjs` file. Every runner ID referenced by evidence must be registered. For another specification framework, use `source: files` with paths targeting its Markdown scenario files unless the CLI supports a dedicated source.

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

While a named change still contains `planned:` evidence, validate its structure with `focused-spec validate --change <name> --syntax-only` and its configuration with `focused-spec validate --change <name>` (without `--strict`). Planned targets are not resolved or executed; a successful planning check does not prove them.

Only after implementing the tests and runner, replace all `planned:` references with concrete selectors. Then verify the completed change:

```sh
focused-spec validate --change <name> --strict
focused-spec run --change <name>
```

For current specifications (no change):

```sh
focused-spec validate
focused-spec run
```

Do not run `--strict` or `run` against a change that intentionally still contains `planned:`; their failure is expected, not a proposal defect. Full validation resolves non-planned evidence; `run` performs strict validation and executes it. `SKIP` and `ERROR` are not success. Use `--allow-skip` only when explicit project policy permits unavailable optional evidence.
