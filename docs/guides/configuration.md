# Configure and author

## Configuration

Create `.focused-spec/config.yaml` in the project root. Version 4 registers format adapters separately from document layouts and loads both formats and runners from an installed package or a project-relative module:

```yaml
version: 4
specifications:
  formats:
    markdown:
      package: '@focused-spec/format-markdown'
    gherkin:
      package: '@focused-spec/format-gherkin'
  documents:
    - match: specs/**/*.md
      scope: current
      format: markdown
      exclude:
        - specs/archive/**
    - match: changes/{scope}/spec.md
      format: markdown
    - match: features/**/*.feature
      scope: current
      format: gherkin
evidence:
  files:
    - .focused-spec/evidence/auth.yaml
    - .focused-spec/evidence/billing/*.yaml
runners:
  go:
    package: '@focused-spec/runner-go'
    timeoutMs: 120000
  pytest:
    package: '@focused-spec/runner-pytest'
    options:
      command: uv
      commandArgs: [run, --with, pytest, python]
    timeoutMs: 120000
execution:
  maxConcurrentGroups: 1
```

`formats` is a nonempty ID map. Every format declares exactly one `package` or `module`, with optional JSON-compatible `options` and `timeoutMs`. A package is an installed package or public subpath resolved from the consuming project with ESM import conditions; it is not a URL, filesystem path, global installation, or downloading fallback. A module is a project-relative `.ts`, `.mts`, `.js`, or `.mjs` file that remains inside the project. Format adapters are trusted project code executed in bounded isolated hosts, not security sandboxes. The core contains no built-in Markdown or Gherkin parser and never infers a format from an extension.

`documents` is a nonempty ordered list. Every entry names one registered `format` and assigns exactly one path-safe scope in one of two ways:

- an explicit layout has `scope: <name>` and no `{scope}` token in `match`;
- a captured layout has exactly one `{scope}` token in `match` and no `scope` property.

`match` and optional `exclude` globs are project-relative and may select any extension accepted by the chosen adapter. Absolute paths, traversal, symlink escapes, malformed captures, and unknown format IDs are errors. `{scope}` captures one nonempty path-safe fragment and preserves it exactly. It may be a complete segment, such as `changes/{scope}/spec.md`, or the variable part of one segment, such as `specs/spec-{scope}/SPEC.md`.

A harmless leading `./` (including repeated `./` prefixes) does not change discovery or `{scope}` capture, including layouts with a following `**`.

There are no implicit archive exclusions, source-framework defaults, privileged scopes, format defaults, or fallback locations. Multiple layouts may contribute documents to one scope, but each document must match exactly one layout and scope; overlapping claims are errors.

Document matches, exclusions and evidence source patterns share security limits: at most 4096 characters, 32 nested brace/group levels (parentheses separately limited to 2 levels), 256 unescaped brace delimiter characters and 256 brace-expanded alternatives per pattern. Excess fails with a `glob pattern exceeds ...` violation before matching or plugin loading; selected files are never silently truncated. Hidden files are included, matching is case-sensitive, and padded (`{01..03}`) and stepped (`{1..5..2}`) ranges retain their numeric meaning. Split oversized alternatives into explicit source patterns instead of increasing the limits.

Runner IDs name execution environments. Like formats, a runner declares exactly one installed `package` or contained project `module`, with optional JSON-compatible `options` and `timeoutMs`; runners additionally accept a project-relative `cwd`. `timeoutMs` is a positive integer no greater than `2147482647`. `execution.maxConcurrentGroups` is optional, defaults to 1, and only permits overlap for compatible groups explicitly returned by runners. The public runner API remains version 1. See the [runner guide](runners.md) and [plugin API reference](../reference/runner-api.md).

Format and runner options must be JSON-compatible: cyclic YAML aliases are rejected as configuration violations before plugins load. Reusing an acyclic alias in several option fields is valid.

## Required evidence registry

Every configured project needs one logical evidence registry. Optional `evidence.files` explicitly names a nonempty list of project-relative `.yaml`/`.yml` paths or glob patterns. Without `evidence`, the same loader reads `.focused-spec/evidence.yaml`; an explicit list never falls back to that file. All sources resolve from the selected project root, including with `--config`.

Each configured source must match at least one file. Absolute paths, parent traversal, negated patterns, backslashes, symlink escapes, non-YAML matches, and overlapping lexical or canonical file claims fail. Files are loaded deterministically; no nested `include` or implicit repository search exists.

A matched dangling source symlink is an unreadable-source error, including when other shards are readable. The pattern limits above apply to every evidence source; an invalid pattern prevents loading a partial registry.

For example, `evidence.files: ['.focused-spec/evidence/**/*.{yaml,yml}']` automatically includes new YAML shards anywhere under that directory. Files already covered by a glob need no separate configuration entry; add a source only for a shard outside the configured patterns. This repository uses that recursive pattern.

Every shard uses the same schema:

```yaml
scopes:
  current:
    auth.login.blocked-account:
      evidence:
        - go::./internal/auth::TestBlockedAccount
        - pytest::tests/functional/test_auth.py::test_blocked_account
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

### Editable Markdown with `@focused-spec/format-markdown`

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

The marker belongs to exactly the adjacent structural item. One blank line is allowed; two blank lines or an intervening node detach it, including inside lists. Before a list, it identifies the immediately following first item, not the whole list. A detached marker, an invalid ID, two markers on one item, or one `(scope, ID)` bound to multiple items is an error. Headings require a preceding marker; inline markers are supported only at the end of a paragraph or the complete list item, after all its content. Code examples never enroll items.

### Gherkin with `@focused-spec/format-gherkin`

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
        - pytest::tests/test_order_limit.py::test_order_at_limit_rejects_another_item
```

The declaration must occur explicitly and uniquely in that path. `focused-spec` never guesses identity from a heading, line number, or similar behavior wording. If generated output has no stable explicit native ID, external binding is unsupported; do not create a companion that duplicates the behavior merely to enroll it.

The official Markdown adapter recognizes a leading bold or inline-code ID alone or followed by `:` in a Markdown item, or a heading `{#ID}` anchor. The official Gherkin adapter recognizes a scenario-local non-focused tag. Markdown token IDs contain letters, digits, `.`, `_`, or `-`. Third-party adapters define their own explicit native-ID declarations through the same normalized format contract. Plain-text mentions do not declare an ID. `source.path` names one configured document; `./` is normalized, traversal and symlink escapes are rejected. Every registry file must also remain inside the project.

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

Syntax-only validation checks configuration, registry shape, adapter parsing, and binding without loading runner plugins. Full validation resolves concrete evidence but does not execute tests. Once all selected references are concrete:

```sh
focused-spec validate --scope add-auth --strict
focused-spec run --scope add-auth
```

Use `focused-spec run --scope add-auth --scenario auth.login.blocked-account` to isolate one entry while other work in the scope is incomplete. Run the full scope before claiming the scope complete. `SKIP` and `ERROR` are not success; use `--allow-skip` only when explicit project policy permits unavailable optional evidence.

## Runnable framework examples

From this repository's root, install the private workspace, build core followed by every adapter, and invoke the workspace-linked CLI:

```sh
npm ci
npm run build
npx focused-spec validate --root examples/openspec --strict
npx focused-spec run --root examples/openspec
```

| Framework layout | Native binding | Additional commands |
| --- | --- | --- |
| [OpenSpec](../../examples/openspec/) | Marker on `openspec/specs/auth/spec.md` Scenario | The commands above |
| [Spec Kit](../../examples/spec-kit/) | Marker on the existing numbered acceptance item | `npx focused-spec validate --root examples/spec-kit --scope 001-blocked-account --strict` then `npx focused-spec run --root examples/spec-kit --scope 001-blocked-account` |
| [BMad](../../examples/bmad/) | Registry `source` binding to generated `SPEC.md` ID `CAP-1` | `npx focused-spec validate --root examples/bmad --scope order-limit --strict` then `npx focused-spec run --root examples/bmad --scope order-limit` |
| [Standalone worktree consumer](../../examples/worktree-consumer/) | Marker on `specs/eligibility.md` | Commit this example as a separate Git repository, add a worktree, then run `npm ci` and `npm run evidence` there |

The examples preserve real tests and explicitly registered official format/runner packages. OpenSpec and the standalone example use `go`; OpenSpec also uses `pytest`, and Spec Kit and BMad use `pytest` with `command: uv` and `commandArgs: [run, --with, pytest, python]` (requires `uv`). Each fresh standalone worktree needs its own `npm ci`.

## Migrate older configurations

Versions 2 and 3 are rejected. There are no compatibility aliases, built-in parser fallback, or automatic converter. For an agent-led update, ask it to update focused-spec. The replacement local package and loader serve the complete portable [upgrade procedure](../../guidance/workflow.md#update-an-existing-project) through `instructions --protocol 1 --topic workflow --json` even while the old configuration is rejected.

### Version 3 to version 4

1. Inventory every document layout, assigned scope, exclusion, registry source, runner ID/configuration, and executable evidence reference. Determine the actual format of every layout; do not infer it from the filename during execution.
2. Install the selected format adapters independently. For the built-in-era formats, install `@focused-spec/format-markdown` and/or `@focused-spec/format-gherkin`; the `focused-spec` core alone no longer parses either format.
3. Change `version: 3` to `version: 4`, add `specifications.formats`, and add `format: <id>` to every document layout. Preserve each layout's `match`, `scope` or `{scope}` capture, and `exclude` settings exactly unless the canonical native source genuinely moved.
4. Give every format and runner exactly one `package` or `module`. During an agent-led upgrade, replace legacy project-local framework registrations with applicable official packages when their documented contracts preserve the existing opaque selectors and execution requirements. Retain custom registrations and established IDs when an official runner cannot preserve their required contract. Install each chosen package separately and use the framework ID `vitest`, `pytest`, or `go`; for every replaced registration, update only the runner-ID prefix in every affected evidence reference while preserving each opaque selector and AND member. Remove obsolete registrations, but preserve project-owned runner files unless their removal is separately authorized. Preserve runner `options`, `timeoutMs`, optional `cwd`, and `execution` settings.
5. Preserve `evidence.files`, every registry shard, `(scope, ID)`, native binding, opaque selector, and AND member byte-for-byte. Apart from an intentional complete runner-ID-prefix migration to an official package, version 4 changes plugin selection, not evidence identity or ownership.
6. Compare the final inventory, then validate native bindings and execute every completed scope. Do not claim a complete-project pass while planned evidence remains.

### Version 2 native-evidence migration

1. Inventory every configured scope, ID, canonical native item and exact evidence reference before editing. Preserve all AND members, opaque selectors, runner settings, execution settings, layout scopes and exclusions. Record any legacy runner ID that will intentionally become the official `vitest`, `pytest`, or `go` ID.
2. Move inline evidence into the configured evidence-only registry (default `.focused-spec/evidence.yaml`). Bind each original ID on its canonical native item: use an adjacent Markdown marker, a Gherkin scenario tag, or `source.path` plus an explicit stable `source.nativeId` for generated/metadata-hostile sources.
3. Remove inline `ID`, `EVIDENCE`, and `REVISES` metadata and obsolete relationship fields without changing behavioral text. Remove a duplicate focused companion only through its host workflow; if it is the sole native source, retain it as the native item.
4. Create the version-4 format map and select a format for every layout as described above. Install selected adapters independently; preserve every document scope/exclusion, registry source and runner/execution setting. Project runner modules remain API version 1, but compatible legacy framework wrappers migrate to the official packages as described above. Use `vitest`, `pytest`, or `go` consistently in the runner map and evidence prefixes while leaving opaque selectors unchanged.
5. Compare the migrated occurrences with the original inventory, resolve `planned:` only when the exact target exists, validate bindings, and execute every completed scope. Each same-ID scope occurrence keeps explicit evidence; nothing inherits.
