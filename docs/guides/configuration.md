# Configure and author

## Configuration

Create `.focused-spec/config.yaml` in the project root. Version 2 discovers scenario-bearing Markdown through explicit document layouts:

```yaml
version: 2
specifications:
  documents:
    - match: specs/**/*.md
      scope: baseline
      exclude:
        - specs/archive/**
    - match: changes/{scope}/spec.md
runners:
  go-unit:
    module: ./.focused-spec/runners/go-test.ts
    timeoutMs: 120000
  pytest-functional:
    module: ./.focused-spec/runners/pytest.ts
    timeoutMs: 120000
```

`documents` is a nonempty ordered list. Every entry is exactly one of:

- a baseline layout, with `scope: baseline` and no `{scope}` token in `match`;
- a named-scope layout, with exactly one `{scope}` token in `match` and no `scope` property.

`match` and optional `exclude` globs are project-relative. They must select Markdown inside the project; absolute paths, traversal, symlink escapes, malformed scope captures, and non-Markdown matches are errors. `{scope}` captures one nonempty, path-safe fragment and preserves its name exactly. It can occupy a complete path segment, as in `changes/{scope}/spec.md`, or the variable part of one segment, as in `specs/spec-{scope}/SPEC.md`. Ordinary glob wildcards remain available outside that capture.

An `exclude` list narrows only its own entry. There are no implicit archive exclusions, framework defaults, or fallback locations. Multiple entries may contribute documents to one named scope, but each document must match exactly one entry and scope; overlapping claims are errors.

Configure files that contain focused scenarios, not every artifact understood by the surrounding specification-driven development (SDD) framework. `focused-spec` does not interpret native requirements prose, infer evidence from Given/When/Then, or validate the framework's own schema. If the native format cannot contain focused scenarios, point a layout at an explicit companion Markdown document produced or maintained through that framework's workflow.

A project may have no baseline documents. A baseline-only layout that matches nothing is also a valid empty baseline. In contrast, an explicitly selected scope with no matching documents is an error, and every discovered named scope must contain at least one focused scenario. A broad or incorrect glob is never widened to hide an absent or empty scope.

A runner ID names one execution environment. Runner modules are project-relative `.ts`, `.mts`, `.js`, or `.mjs` files. `timeoutMs` is an optional positive integer per runner, at most `2147482647` ms. The limit leaves room for the host's one-second shutdown grace period within Node's timer range. The complete runner contract is in the [runner API reference](../reference/runner-api.md).

## Scenario

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./internal/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Keep each scenario to one request and one independently failing outcome. Put independently failing behavior in separate scenarios. Evidence has the form `[planned:]<runner-id>::<opaque selector>`; multiple rows form an AND contract.

Stable IDs are repository-wide. A named-scope scenario that intentionally revises an existing baseline scenario keeps its ID and declares the relationship explicitly:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **REVISES**: baseline
- **EVIDENCE**: `planned:go-unit::./internal/auth::TestBlockedAccountWithAudit`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected and the attempt is audited
```

`REVISES` is optional and may appear exactly once, with the value `baseline`. It is valid only in a named scope whose baseline owns the same ID. Baseline scenarios cannot revise themselves, and framework headings such as OpenSpec `MODIFIED Requirements` do not grant permission to reuse an ID. Two scopes may independently revise the same baseline ID, but they may not introduce the same new ID.

`planned:` is temporary planning evidence. It is allowed only in named scopes during non-strict validation. Baseline evidence must always be concrete. Choose the real runner and selector contract before adding a planned row, then remove `planned:` when that exact test target exists.

## Scope and verification

Without `--scope`, validation covers the baseline and every discovered named scope; `run` validates that same set strictly and then executes only the baseline. With `--scope <name>`, validation covers the baseline and only that named scope, while `run` executes only that scope. `--scenario` narrows execution, never validation. See the [CLI reference](../reference/cli.md) for exact result fields.

While a named scope still contains planned evidence, validate its structure and concrete evidence without strict mode:

```sh
focused-spec validate --scope add-auth --syntax-only
focused-spec validate --scope add-auth
```

Planned targets are not resolved or executed. After implementing the tests and replacing planned references with concrete selectors, verify the completed scope:

```sh
focused-spec validate --scope add-auth --strict
focused-spec run --scope add-auth
```

For baseline work when all discovered scopes are complete:

```sh
focused-spec validate
focused-spec run
```

`run` always performs strict validation first. `SKIP` and `ERROR` are not success; use `--allow-skip` only when explicit project policy permits unavailable optional evidence.

## Migrate from version 1

Version 2 is a clean cutover: version-1 configuration and `source`, `paths`, and `root` keys are rejected.

- Replace each file-backed `paths` entry with `{ match: <glob>, scope: baseline }` under `specifications.documents`.
- Replace `source: openspec` with explicit baseline and named-scope layouts, for example `openspec/specs/**/spec.md` with `scope: baseline` and `openspec/changes/{scope}/specs/**/spec.md` without it.
- Add explicit `exclude` globs when a pattern would otherwise select archives or history. The CLI supplies none.
- Replace `--change <name>` with `--scope <name>`. The [CLI reference](../reference/cli.md) owns the corresponding text and JSON result migration.
