# Configure and author

## Configuration

Create `.focused-spec/config.yaml` in the project root. Version 2 discovers scenario-bearing Markdown through explicit document layouts:

```yaml
version: 2
specifications:
  documents:
    - match: specs/**/*.md
      scope: current
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

`documents` is a nonempty ordered list. Every entry assigns exactly one path-safe scope in one of two ways:

- an explicit layout has `scope: <name>` and no `{scope}` token in `match`;
- a captured layout has exactly one `{scope}` token in `match` and no `scope` property.

`match` and optional `exclude` globs are project-relative. They must select Markdown inside the project; absolute paths, traversal, symlink escapes, malformed scope captures, and non-Markdown matches are errors. `{scope}` captures one nonempty, path-safe fragment and preserves its name exactly. It can occupy a complete path segment, as in `changes/{scope}/spec.md`, or the variable part of one segment, as in `specs/spec-{scope}/SPEC.md`. Ordinary glob wildcards remain available outside that capture.

An `exclude` list narrows only its own entry. There are no implicit archive exclusions, framework defaults, default scopes, or fallback locations. Multiple entries may contribute documents to one scope, but each document must match exactly one entry and scope; overlapping claims are errors. `baseline` is permitted as an ordinary scope name and receives no special behavior.

Configure files that contain focused scenarios, not every artifact understood by the surrounding specification-driven development (SDD) framework. `focused-spec` does not interpret native requirements prose, infer evidence from Given/When/Then, or validate the framework's own schema. If the native format cannot contain focused scenarios, point a layout at an explicit companion Markdown document produced or maintained through that framework's workflow.

A project whose layouts match no documents has a valid empty selection when no scope is explicitly requested. In contrast, `--scope <name>` is an assertion that the named scope exists: no matching documents is an error. Every discovered scope must contain at least one focused scenario. A broad or incorrect glob is never widened to hide an absent or empty scope.

A runner ID names one execution environment. Runner modules are project-relative `.ts`, `.mts`, `.js`, or `.mjs` files. `timeoutMs` is an optional positive integer per runner, at most `2147482647` ms. The limit leaves room for the host's one-second shutdown grace period within Node's timer range. The complete runner contract is in the [runner API reference](../reference/runner-api.md).

To allow safe runner-declared groups to overlap, optionally set the global runner-host limit:

```yaml
execution:
  maxConcurrentGroups: 2
```

`maxConcurrentGroups` must be a positive integer and defaults to 1. The setting does not split runner targets or infer test independence; participating runner plugins define their own group and resource policy, whether in code, runner-owned configuration, or another project-specific source. Core reads only the groups those plugins return. Runners without partition support remain exclusive, even when the limit exceeds 1. See the [runner guide](runners.md) and [runner API reference](../reference/runner-api.md).

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

Stable IDs are repository-wide through explicit ownership. A scenario that intentionally reuses an ID from another scope keeps the ID and declares its source scope:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **REVISES**: current
- **EVIDENCE**: `planned:go-unit::./internal/auth::TestBlockedAccountWithAudit`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected and the attempt is audited
```

`REVISES` is optional and may appear exactly once. Its value is the path-safe name of another scope containing the same ID. Within one scope an ID is always unique. Across scopes, one unmarked scenario owns the ID; every additional occurrence must point to an existing same-ID scenario in another scope, and each chain must reach that single owner. Self-revisions, missing sources, cycles, multiple unmarked owners, and unmarked collisions are errors. Branches are valid, so two scopes may independently revise the same source. Framework headings such as OpenSpec `MODIFIED Requirements` and names such as `baseline` grant no ownership.

`planned:` is temporary planning evidence allowed in every scope during non-strict validation. Choose the real runner and selector contract before adding a planned row, then remove `planned:` when that exact test target exists. Strict validation and `run` reject planned evidence in every scope.

## Scope and verification

Without `--scope`, `validate` and `run` select all discovered scopes. With `--scope <name>`, both select only that scope. `run --scenario <id>` narrows strict validation, evidence resolution, and execution to matching scenarios in the selected scopes; without `--scope`, repeated IDs select every matching scope. It does not change `validate` or the behavior of `run` without `--scenario`. See the [CLI reference](../reference/cli.md) for exact result fields.

While a scope still contains planned evidence, validate its structure and concrete evidence without strict mode:

```sh
focused-spec validate --scope add-auth --syntax-only
focused-spec validate --scope add-auth
```

Planned targets are not resolved or executed. After implementing the tests and replacing planned references with concrete selectors, verify the completed scope:

```sh
focused-spec validate --scope add-auth --strict
focused-spec run --scope add-auth
```

While a scope contains unrelated unfinished scenarios, use `focused-spec run --scope add-auth --scenario auth.login.blocked-account` to validate and execute only that scenario. Run the full scope after replacing all planned references; a successful scenario-only run does not certify the scope.

For all discovered scopes when every planned reference has been replaced:

```sh
focused-spec validate
focused-spec run
```

`run` always performs strict validation first. `SKIP` and `ERROR` are not success; use `--allow-skip` only when explicit project policy permits unavailable optional evidence.

## Runnable framework examples

From this repository's root after `npm install` and `npm run build`, these independent examples demonstrate explicit document selection and real test evidence:

| Framework layout | Focused document | Commands |
| --- | --- | --- |
| [OpenSpec](../../examples/openspec/) | `openspec/specs/auth/spec.md` | `node dist/cli.js validate --root examples/openspec --strict` then `node dist/cli.js run --root examples/openspec` |
| [Spec Kit](../../examples/spec-kit/) | `specs/001-blocked-account/spec.md`, focused block inside native **Acceptance Scenarios** | `node dist/cli.js validate --root examples/spec-kit --scope 001-blocked-account --strict` then `node dist/cli.js run --root examples/spec-kit --scope 001-blocked-account` |
| [BMad](../../examples/bmad/) | `_bmad-output/specs/spec-order-limit/scenarios.md` registered in native `SPEC.md` | `node dist/cli.js validate --root examples/bmad --scope order-limit --strict` then `node dist/cli.js run --root examples/bmad --scope order-limit` |

All examples use project-local runners and real tests; the OpenSpec example runs Go and pytest, while Spec Kit and BMad use pytest through `uv run --with pytest python -m pytest` (requires `uv`). They demonstrate layouts, not substitutes for each framework's own generator, schema validation, or CLI. The Spec Kit and BMad commands explicitly select one scope; omitting `--scope` runs every scope their configurations discover. Native requirements alone never count as focused evidence.

## Migrate from version 1

Version 2 is a clean cutover: version-1 configuration and `source`, `paths`, and `root` keys are rejected.

- Replace each file-backed `paths` entry with `{ match: <glob>, scope: <name> }` under `specifications.documents`.
- Replace `source: openspec` with explicit layouts, for example `openspec/specs/**/spec.md` with `scope: current` and `openspec/changes/{scope}/specs/**/spec.md` with a scope capture.
- Add explicit `exclude` globs when a pattern would otherwise select archives or history. The CLI supplies none.
- Replace `--change <name>` with `--scope <name>`. The [CLI reference](../reference/cli.md) owns the corresponding text and JSON result migration.
