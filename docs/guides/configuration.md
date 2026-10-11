# Configure and author

## Configuration

Create `.focused-spec/config.yaml` in the project root. Version 3 discovers native Markdown and Gherkin documents through explicit layouts while preserving the runner and execution configuration:

```yaml
version: 3
specifications:
  documents:
    - match: specs/**/*.{md,feature}
      scope: current
      exclude:
        - specs/archive/**
    - match: changes/{scope}/spec.md
evidence:
  files:
    - .focused-spec/evidence/auth.yaml
    - .focused-spec/evidence/billing/*.yaml
runners:
  go-unit:
    module: ./.focused-spec/runners/go-test.ts
    timeoutMs: 120000
  pytest-functional:
    module: ./.focused-spec/runners/pytest.ts
    timeoutMs: 120000
execution:
  maxConcurrentGroups: 1
```

`documents` is a nonempty ordered list. Every entry assigns exactly one path-safe scope in one of two ways:

- an explicit layout has `scope: <name>` and no `{scope}` token in `match`;
- a captured layout has exactly one `{scope}` token in `match` and no `scope` property.

`match` and optional `exclude` globs are project-relative and may select only `.md` and `.feature` files inside the project. Absolute paths, traversal, symlink escapes, malformed captures, and unsupported extensions are errors. `{scope}` captures one nonempty path-safe fragment and preserves it exactly. It may be a complete segment, such as `changes/{scope}/spec.md`, or the variable part of one segment, such as `specs/spec-{scope}/SPEC.md`.

There are no implicit archive exclusions, source-framework defaults, privileged scopes, or fallback locations. Multiple layouts may contribute documents to one scope, but each document must match exactly one layout and scope; overlapping claims are errors.

Runner configuration and the public runner API are unchanged. A runner ID names one execution environment. Modules are project-relative `.ts`, `.mts`, `.js`, or `.mjs` files. `timeoutMs` is an optional positive integer no greater than `2147482647`. `execution.maxConcurrentGroups` is optional, defaults to 1, and only permits overlap for compatible groups explicitly returned by runners. See the [runner guide](runners.md) and [runner API reference](../reference/runner-api.md).

## Required evidence registry

Every configured project needs one logical evidence registry. Optional `evidence.files` explicitly names a nonempty list of project-relative `.yaml`/`.yml` paths or glob patterns. Without `evidence`, the same loader reads `.focused-spec/evidence.yaml`; an explicit list never falls back to that file. All sources resolve from the selected project root, including with `--config`.

Each configured source must match at least one file. Absolute paths, parent traversal, negated patterns, backslashes, symlink escapes, non-YAML matches, and overlapping lexical or canonical file claims fail. Files are loaded deterministically; no nested `include` or implicit repository search exists.

For example, `evidence.files: ['.focused-spec/evidence/**/*.{yaml,yml}']` automatically includes new YAML shards anywhere under that directory. Files already covered by a glob need no separate configuration entry; add a source only for a shard outside the configured patterns. This repository uses that recursive pattern.

Every shard uses the same schema:

```yaml
scopes:
  current:
    auth.login.blocked-account:
      evidence:
        - go-unit::./internal/auth::TestBlockedAccount
        - pytest-functional::tests/functional/test_auth.py::test_blocked_account
```

The exact schema is:

```yaml
scopes:
  <scope>:
    <lowercase.dotted.id>:
      evidence:
        - "[planned:]<runner-id>::<opaque selector>"
      source:                 # optional; external binding only
        path: project/relative/document.md
        nativeId: EXPLICIT-HOST-ID
```

Each entry requires a nonempty `evidence` list. `source` is present only for external binding and contains exactly `path` and `nativeId`. Unknown fields and duplicate YAML fields fail validation. A selected `(scope, ID)` may occur only once across all files; duplicates fail with both locations, without merging evidence or choosing a winner. File placement does not change identity or imply scope ownership. Empty `scopes: {}` files are permitted, but all configured sources remain required; an empty logical registry succeeds only for an empty all-scope selection with no discovered documents.

Evidence stays out of native documents. Multiple references on one entry form an AND contract. The selector is opaque to core, and only the first `::` separates the runner ID. Use `planned:` only while the exact target is absent; strict validation and `run` reject planned references.

The public API is `loadEvidenceRegistry(projectRoot, files?, selectedScope?, selectedScenarioId?)`; pass `config.evidence?.files` as its second argument. It returns named `EvidenceRegistry` with `entries`, sorted loaded `files`, and `violations`. Each `EvidenceEntry` exposes diagnostic-only `registryPath` and `line`, separate from optional native `source` binding metadata. Scope/ID selection arguments now follow the source list.

## Bind a native item

Keep behavior in the owning framework's native item. Choose exactly one supported identity binding.

### Editable Markdown

Place the marker immediately before one heading, paragraph, or list item:

```markdown
<!-- focused-spec:id=auth.login.blocked-account -->
#### Scenario: Blocked account submits valid credentials
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

A paragraph or list item may instead carry the marker inline at its end:

```markdown
1. **Given** a blocked account, **When** it logs in, **Then** authentication is rejected. <!-- focused-spec:id=auth.login.blocked-account -->
```

The marker belongs to exactly the adjacent structural item. One blank line is allowed; two blank lines or an intervening node detach it. Before a list, it identifies the immediately following first item, not the whole list. A detached marker, an invalid ID, two markers on one item, or one `(scope, ID)` bound to multiple items is an error. Inline markers must be at the item's end. Code examples never enroll items.

### Gherkin

Attach the focused tag to one `Scenario` or `Scenario Outline`:

```gherkin
@focused.auth.login.blocked-account
Scenario: Blocked account submits valid credentials
  Given a blocked account with valid credentials
  When the account attempts to log in
  Then authentication is rejected
```

Focused tags on `Feature`, `Rule`, `Background`, or `Examples` are invalid. Ordinary non-focused tags remain the host framework's concern.

### External native ID

Generated output must remain unmarked. When it declares a stable host-owned ID, bind that declaration from the registry:

```yaml
scopes:
  order-limit:
    order.limit.reject-at-capacity:
      source:
        path: _bmad-output/specs/spec-order-limit/SPEC.md
        nativeId: CAP-1
      evidence:
        - pytest-functional::tests/test_order_limit.py::test_order_at_limit_rejects_another_item
```

The declaration must occur explicitly and uniquely in that path. `focused-spec` never guesses identity from a heading, line number, or similar behavior wording. If generated output has no stable explicit native ID, external binding is unsupported; do not create a companion that duplicates the behavior merely to enroll it.

Supported explicit declarations are a leading bold or inline-code ID alone or followed by `:` in a Markdown item, a heading `{#ID}` anchor, or a scenario-local non-focused Gherkin tag. Markdown token IDs contain letters, digits, `.`, `_`, or `-`. Plain-text mentions do not declare an ID. `source.path` names one configured document; `./` is normalized, traversal and symlink escapes are rejected. Every registry file must also remain inside the project.

## Binding and selection rules

Every marked item needs a registry entry in the same scope, and every registry entry must bind exactly one item. Missing, detached, duplicate, conflicting, unbound, or ambiguous bindings fail. Unmarked native items remain valid host content but are not focused scenarios, are not executed, and are not counted as an invented coverage metric.

Identity is `(scope, ID)`. The same ID may appear in different scopes only as independent entries with independent bindings and evidence. Evidence never inherits, and there is no relationship field.

Without `--scope`, validation and execution select all scopes. With `--scope <name>`, both select only that scope. `run --scenario <id>` further isolates the matching entries, their bindings, and their evidence from unrelated failures. See the [CLI reference](../reference/cli.md) for result fields.

Scope and scenario selection isolate unrelated entry semantics and cross-file duplicate identities. Source safety, missing sources, YAML syntax, and duplicate YAML fields remain errors because they prevent reliable composition. Registry entry/binding violations identify the actual shard and line.

## Verify

While a selected entry contains planned evidence:

```sh
focused-spec validate --scope add-auth --syntax-only
focused-spec validate --scope add-auth
```

Syntax-only validation checks configuration, registry shape, native parsing, and binding without loading runner modules. Full validation resolves concrete evidence but does not execute tests. Once all selected references are concrete:

```sh
focused-spec validate --scope add-auth --strict
focused-spec run --scope add-auth
```

Use `focused-spec run --scope add-auth --scenario auth.login.blocked-account` to isolate one entry while other work in the scope is incomplete. Run the full scope before claiming the scope complete. `SKIP` and `ERROR` are not success; use `--allow-skip` only when explicit project policy permits unavailable optional evidence.

## Runnable framework examples

From this repository's root after the existing `npm install` and `npm run build` workflow:

| Framework layout | Native binding | Commands |
| --- | --- | --- |
| [OpenSpec](../../examples/openspec/) | Marker on `openspec/specs/auth/spec.md` Scenario | `node dist/cli.js validate --root examples/openspec --strict` then `node dist/cli.js run --root examples/openspec` |
| [Spec Kit](../../examples/spec-kit/) | Marker on the existing numbered acceptance item | `node dist/cli.js validate --root examples/spec-kit --scope 001-blocked-account --strict` then `node dist/cli.js run --root examples/spec-kit --scope 001-blocked-account` |
| [BMad](../../examples/bmad/) | Registry `source` binding to generated `SPEC.md` ID `CAP-1` | `node dist/cli.js validate --root examples/bmad --scope order-limit --strict` then `node dist/cli.js run --root examples/bmad --scope order-limit` |
| [Standalone worktree consumer](../../examples/worktree-consumer/) | Marker on `specs/eligibility.md` | Commit this example as a separate Git repository, add a worktree, then run `npm ci` and `npm run evidence` there |

The examples preserve their project-local runners and real tests. OpenSpec and the standalone example use Go; OpenSpec also uses pytest, and Spec Kit and BMad use pytest through `uv run --with pytest python -m pytest` (requires `uv`). The standalone package declares `focused-spec` as a development dependency, so each fresh worktree needs its own `npm ci`.

## Migrate from version 2

Version 3 is a clean cutover. Version-2 configuration and bold `ID`/`EVIDENCE` scenario rows are rejected; there are no aliases or compatibility parser.

For an agent-led update, ask it to update focused-spec. The local package and installed loader must be refreshed before migration. The replacement CLI serves the complete portable [upgrade procedure](../../guidance/workflow.md#update-an-existing-project) through `instructions --protocol 1 --topic workflow --json`, even before the obsolete configuration is fixed; obsolete-format diagnostics advertise this command. No automatic converter or legacy runtime is provided.

1. Change `version: 2` to `version: 3`. Keep the existing `specifications.documents`, `runners`, and `execution` layouts, adjusting document matches only when the canonical native document differs from an old companion.
2. Create `.focused-spec/evidence.yaml`. Move every scenario's ID and evidence into the corresponding scope entry.
3. Bind the canonical native item. For editable Markdown, attach an adjacent marker; for Gherkin, attach a scenario tag. Remove the old bold metadata rows.
4. If an old focused block duplicated an existing native item, delete the duplicate and mark the native item. If the block was itself the sole native item, preserve its behavioral text and attach the marker to its structural item.
5. For generated documents, remove obsolete focused companions and use `source.path` plus an explicit `source.nativeId`. Do not mark generated output.
6. Preserve every still-relevant `(scope, ID)` and every exact evidence reference, including all AND members. Remove `REVISES` rows and relationship fields; each same-ID scope occurrence needs explicit evidence, never inheritance. Preserve runner/execution settings and unrelated content.
7. Compare the migrated occurrences with the original inventory, validate bindings, resolve obsolete `planned:` references only when their exact tests exist, and execute every completed scope's selected evidence. Runner plugins require no API migration. Do not claim a complete-project pass while planned evidence remains.
