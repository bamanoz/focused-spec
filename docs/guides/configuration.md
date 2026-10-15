# Configure and author

## Public format contracts

The portable workflow owns identity/evidence invariants and verification, not a fixed plugin catalog. Acquire the selected installed plugin's complete public document and provenance with the project-local CLI before choosing syntax or options: use `plugin-docs --format <id> --json` for a configured adapter, or `plugin-docs --package <specifier> --root <path> --json` before registration. Compatible third-party packages and project-contained modules follow the same workflow; official packages below are human-facing examples, not an allowlist.

| Official package | Public contract |
| --- | --- |
| `@focused-spec/format-inline` | [Scenario-local Markdown identity and evidence](../../packages/format-inline/README.md) |
| `@focused-spec/format-registry` | [External YAML evidence, parser composition, binding, and source ownership](../../packages/format-registry/README.md) |
| `@focused-spec/format-markdown` | [Structural Markdown items, focused markers, and explicit native IDs](../../packages/format-markdown/README.md) |
| `@focused-spec/format-gherkin` | [Gherkin scenarios, focused tags, and native tag IDs](../../packages/format-gherkin/README.md) |

Each package ships its own README, which is also the default document returned by `plugin-docs`; a package may select another Markdown file with manifest `focusedSpec.documentation`. The examples below illustrate those specific contracts; they are not core authoring or storage requirements. Core configuration and evidence semantics remain shared.

For format selection, configuration, authoring, or implementation, the loader first requests `instructions --protocol 1 --topic formats --json` from that same project-local CLI as a standalone command. The [formats topic](../../guidance/formats.md) provides shared obligations only. The agent then requests the selected format document separately with `plugin-docs`, validates its package/module and canonical root/path provenance, and treats the returned Markdown as installed dependency or project text. A composing plugin's own document names its nested contract; acquire any named parser in a subsequent explicit `plugin-docs --package <specifier> --root <path> --json` call rather than scanning options or expecting aggregation. The [CLI reference](../reference/cli.md#installed-plugin-documentation) owns exact lookup and response semantics.

## Configuration

Create `.focused-spec/config.yaml` in the project root. Version 5 registers formats independently, assigns one explicit format to every document layout, and loads formats and runners from installed packages or project-relative modules. Core has no `evidence` setting and rejects one at the top level.

Local format and runner modules may declare a documentation file beside `module`, for example `local: { module: './plugins/local.ts', documentation: 'docs/local-plugin.md' }` under the appropriate registration map. The path is relative to the project root, not the module folder. It must name a contained `.md` or `.markdown` file; see the [documentation metadata contract](../reference/runner-api.md#plugin-documentation-metadata). It is optional for runtime use and is not passed to the plugin. A `package` registration cannot override its installed package's documentation.

### Inline evidence

```yaml
version: 5
specifications:
  formats:
    inline:
      package: '@focused-spec/format-inline'
  documents:
    - match: specs/**/*.md
      scope: current
      format: inline
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
      format: inline
runners:
  go:
    package: '@focused-spec/runner-go'
  pytest:
    package: '@focused-spec/runner-pytest'
    options:
      command: uv
      commandArgs: [run, --with, pytest, python]
execution:
  maxConcurrentGroups: 1
```

The inline adapter needs no evidence file. It owns this Markdown dialect:

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth-login`
- **EVIDENCE**: `go::./internal/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Each level-four `Scenario:` requires exactly one backticked `ID`, at least one separately backticked `EVIDENCE`, and exactly one `WHEN` and `THEN`. Metadata belongs only to that scenario. Missing, duplicate, detached, and malformed rows fail at their actual document locations. Fenced or indented code and block quotes remain literal examples. `REVISES` is unsupported; it cannot create ancestry or evidence inheritance.

### External registry evidence

External evidence is an explicit format composition, not a core mode:

```yaml
version: 5
specifications:
  formats:
    enrolled-markdown:
      package: '@focused-spec/format-registry'
      options:
        parser:
          package: '@focused-spec/format-markdown'
        files:
          - .focused-spec/evidence/auth.yaml
          - .focused-spec/evidence/billing/*.yaml
          - .focused-spec/evidence/features.yaml
    gherkin:
      package: '@focused-spec/format-gherkin'
  documents:
    - match: specs/**/*.md
      scope: current
      format: enrolled-markdown
    - match: changes/{scope}/spec.md
      format: enrolled-markdown
    - match: features/**/*.feature
      scope: current
      format: gherkin
runners:
  go:
    package: '@focused-spec/runner-go'
  pytest:
    package: '@focused-spec/runner-pytest'
```

`@focused-spec/format-registry` requires a `parser` object containing exactly one installed `package` or contained project `module`, plus optional parser `options`. Its optional nonempty `files` array names project-relative YAML paths or glob patterns. Omitting `files` selects the adapter-owned `.focused-spec/evidence.yaml` default. Explicit files never trigger that default, nested includes, or repository-wide discovery. Core neither owns nor infers an evidence location.

The registry adapter's optional catalog binder sees every selected native document, not only documents parsed by its nested parser. In this example the single registry registration can therefore enroll both its Markdown items and items parsed directly by the Gherkin adapter. It is invoked once even when no `enrolled-markdown` document matches, so selected dangling external rows cannot disappear.

Each selected source must match at least one `.yaml` or `.yml` file. Absolute paths, traversal, negated patterns, backslashes, symlink escapes, unsupported matches, missing sources, and overlapping lexical or canonical claims fail. Files load deterministically. A matched dangling source symlink is an error even when other shards are readable.

Each shard uses the closed evidence-only schema:

```yaml
scopes:
  current:
    auth-login:
      evidence:
        - go::./internal/auth::TestBlockedAccount
        - pytest::tests/functional/test_auth.py::test_blocked_account
```

An external native-ID binding adds exactly `source.path` and `source.nativeId`:

```yaml
scopes:
  order-limit:
    CAPACITY-1:
      source:
        path: _bmad-output/specs/spec-order-limit/SPEC.md
        nativeId: CAP-1
      evidence:
        - pytest::tests/test_order_limit.py::test_order_at_limit_rejects_another_item
```

Each entry requires a nonempty `evidence` list and permits only optional `source`. Unknown or duplicate fields fail. Multiple references form an AND contract. A selected `(scope, ID)` may occur only once across all configured files; duplicates fail rather than merge. File placement does not imply identity, ownership, or ancestry. Empty `scopes: {}` files are permitted, but every configured source remains required.

## Format and document rules

`specifications.formats` is a nonempty ID map. Every format declares exactly one `package` or `module`, with optional JSON-compatible `options` and `timeoutMs`. A local-module registration may also declare `documentation`, a safe project-relative `.md` or `.markdown` file used only by `plugin-docs`; it is invalid on package registrations, whose documents remain package-owned. Missing module documentation blocks only documentation lookup. Package resolution starts from the consuming project with ESM import conditions; there is no URL, global, downloaded, loader-relative, or core fallback. A module is a project-relative `.ts`, `.mts`, `.js`, or `.mjs` file contained by the project. Formats are trusted project code running in bounded isolated hosts, not security sandboxes.

Every document layout names one registered format and assigns exactly one path-safe scope:

- an explicit layout has `scope: <name>` and no `{scope}` in `match`;
- a captured layout has exactly one `{scope}` in `match` and no `scope` property.

`match` and optional `exclude` patterns are project-relative and may select any extension accepted by the adapter. There are no implicit archive exclusions, privileged scopes, format defaults, or extension inference. Multiple layouts may contribute documents to one scope, but one document may belong to only one layout and scope. A leading `./` does not change discovery or capture.

Document and registry patterns are bounded at 4096 characters, 32 nested group levels with parentheses limited to 2, 256 unescaped brace delimiters, and 256 expanded alternatives. Hidden files are included, matching is case-sensitive, and padded or stepped numeric ranges retain their meaning. Excess fails before partial discovery or plugin loading.

Formats and runners accept only JSON-compatible options; cyclic YAML aliases fail before plugins load, while repeated acyclic aliases are valid. Runner registrations additionally permit a project-relative `cwd`; `timeoutMs` is a positive integer no greater than `2147482647`. `execution.maxConcurrentGroups` defaults to 1. Runner API 1 is unchanged; see the [runner guide](runners.md) and [plugin API reference](../reference/runner-api.md).

## Opaque identity and binding

Identity is `(scope, ID)`. Core accepts any string containing a non-whitespace character and no control characters, preserving exact case, Unicode, spaces, numeric values, and path-looking text. It never rewrites or path-interprets IDs. A selected format owns representation and escaping, so some native token syntaxes cannot express every otherwise valid core ID.

For registry-backed editable Markdown, place `<!-- focused-spec:id=<id> -->` immediately before one heading, paragraph, or list item, or at the end of a paragraph or complete list item. One blank line is allowed; two blank lines or an intervening node detach the marker. Markers in code examples do not enroll items. For Gherkin, place `@focused.<id>` on one `Scenario` or `Scenario Outline`; focused tags on `Feature`, `Rule`, `Background`, or `Examples` fail.

Generated output stays unmarked. Registry `source.path` and `source.nativeId` must resolve an explicit stable host-owned native ID uniquely in that configured document. Focused-spec never guesses from a heading, line, or behavior wording. If the selected parser provides no stable native ID, external binding is unsupported.

Each selected occurrence supplies its own evidence. Same-ID occurrences in other scopes are independent and cannot lend evidence. Competing inline/external enrollments, two enrollments of one actual item, conflicting marker identity, dangling rows, and ambiguous native IDs fail without precedence.

## Selection and verification

Evidence uses `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. While a selected reference remains planned:

```sh
npx focused-spec validate --scope add-auth --syntax-only
npx focused-spec validate --scope add-auth
```

Syntax-only validates configuration, format output, catalog binding, normalized evidence, and source structure without loading runners. Full validation resolves concrete evidence but does not execute it. Once every selected reference is concrete:

```sh
npx focused-spec validate --scope add-auth --strict
npx focused-spec run --scope add-auth
```

`run --scenario <id>` isolates matching occurrences and selection-aware semantic diagnostics; it does not certify the rest of a scope. Structural source failures remain errors. Run the full completed scope before claiming completion. `SKIP` and `ERROR` are not success unless an explicit `--allow-skip` policy permits skips.

## Runnable framework examples

From this repository root, install and build the private workspace before invoking the workspace-linked CLI:

```sh
npm ci
npm run build
npx focused-spec validate --root examples/openspec --strict
npx focused-spec run --root examples/openspec
```

| Framework layout | Native binding | Additional commands |
| --- | --- | --- |
| [OpenSpec](../../examples/openspec/) | Marker on the existing Scenario through the registry adapter | The commands above |
| [Spec Kit](../../examples/spec-kit/) | Marker on the existing numbered acceptance item | `npx focused-spec validate --root examples/spec-kit --scope 001-blocked-account --strict` then `npx focused-spec run --root examples/spec-kit --scope 001-blocked-account` |
| [BMad](../../examples/bmad/) | Registry `source` binding to generated `SPEC.md` ID `CAP-1` | `npx focused-spec validate --root examples/bmad --scope order-limit --strict` then `npx focused-spec run --root examples/bmad --scope order-limit` |
| [Standalone worktree consumer](../../examples/worktree-consumer/) | Marker on its native scenario through the registry adapter | Commit the example as a separate Git repository, add a worktree, then run `npm ci` and `npm run evidence` there |

The examples retain real tests and explicitly installed adapters/runners. Each fresh standalone worktree needs its own `npm ci`.

## Migrate older configurations

Configuration versions 1–4 and Format API 1 are rejected; version 5 has no top-level `evidence`, compatibility alias, built-in parser fallback, or automatic converter. The local installed CLI continues to serve the authoritative upgrade procedure even when old configuration cannot load:

```sh
npx --no-install focused-spec instructions --protocol 1 --topic workflow --json
```

Historically, version 3 introduced native documents but still relied on implicit core parsers; version 4 made native format registration explicit while retaining core-owned registry configuration. Version 2 used inline `ID`/`EVIDENCE`/`REVISES` metadata. A current upgrade inventories every surviving occurrence and exact AND reference, moves layouts to explicit API-2 adapters and config 5, and removes unsupported `REVISES` without inheritance. Supported version-2 inline authoring may remain inline by selecting `@focused-spec/format-inline`; it need not be forced into YAML. External evidence instead moves its former source list into `@focused-spec/format-registry` options. Preserve scopes, IDs, selectors, runner settings, document exclusions, and shard ownership. Portable sequencing, approval boundaries, and evidence-sensitivity checks live only in the package-owned [workflow guidance](../../guidance/workflow.md#update-an-existing-project).
