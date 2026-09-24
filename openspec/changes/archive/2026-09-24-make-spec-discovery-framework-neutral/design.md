## Context

Today `src/config.ts` accepts `source: files` or `source: openspec`; `src/sources.ts` hard-codes the latter's current and active-change paths, and `--change` rejects the former. `src/parser.ts` parses focused scenario rows but also remembers OpenSpec operation headings; `src/validate.ts` uses those headings to decide when a baseline ID may be reused. `run` reports OpenSpec-named validation/execution scopes. These are separate concerns accidentally tied to one SDD framework. See the four modified capability specs for observable contracts.

## Goals / Non-Goals

**Goals:** One explicit config describes the allowed locations of baseline and named-scope Markdown; scope selection, scenario ownership and evidence execution work identically for any SDD directory convention. Preserve an actionable distinction between absent/empty selected scope and a legitimate empty baseline, strict-vs-planning validation, and exact evidence selector identity. Migrate all shipped clients and docs in the same application.

**Non-Goals:** Interpret arbitrary native SDD prose as focused scenarios; verify an SDD framework's own schema or active-feature metadata; discover files from SDD runtime APIs; add built-in format or discovery plugins. For incompatible source formats, author a focused companion Markdown in the configured location or produce one with the project's own tooling; don't fabricate evidence from Given/When/Then.

## Decisions

### Declarative documents, not named source strategies

Use configuration `version: 2`:

```yaml
version: 2
specifications:
  documents:
    - match: openspec/specs/**/spec.md
      scope: baseline
    - match: openspec/changes/{scope}/specs/**/spec.md
runners:
  vitest:
    module: ./.focused-spec/runners/vitest.ts
```

`documents` is a nonempty ordered array of layout entries, each with `match` and optional `exclude` path globs. Every entry is either `scope: baseline` with no `{scope}` token, or a named-scope entry with exactly one `{scope}` token and no `scope` property. An unmarked pattern without `{scope}`, duplicate captures, invalid keys, non-Markdown matches, absolute/traversal patterns, or paths resolving outside the project root are errors, not implicit defaults. `{scope}` captures one nonempty directory-name fragment (a whole segment or a fixed-prefix/suffix fragment such as `spec-{scope}`); no `*` glob inside the capture segment. Other segments support ordinary glob wildcards, including `**`. `exclude` patterns are project-relative and narrow the entry only; they do not create fallback locations. Scope names are path-safe single fragments, preserved exactly, and CLI input is rejected if unsafe. Matching is lexical and deterministic, sorted by project-relative path; the same resolved Markdown file claimed twice is a diagnostic, not an arbitrary winner. Discovery does not open SDD planning metadata. `src/sources.ts` returns baseline documents and a map of scope names to documents; no OpenSpec import or hard-coded root.

Examples: `openspec/changes/{scope}/spec.md` is an adjacent change spec; `specs/{scope}/spec.md` is a Spec Kit feature companion; `.kiro/specs/{scope}/requirements.md` and `.kiro/specs/{scope}/bugfix.md` are alternative Kiro document names; `specs/spec-{scope}/SPEC.md` supports BMad's naming convention when a focused companion/embedded block is present. Multiple entries can contribute to a scope, e.g. both Kiro names. A project may have only named entries and no baseline. Patterns target scenario-bearing Markdown, not arbitrary SDD documents: choosing a native document without focused scenarios is reported as an empty scope, not executable success.

**Alternative:** dedicated OpenSpec/Spec Kit/Kiro sources or a mandatory source-plugin API. These duplicate a common path concern and make simple local layouts depend on framework code. An unconditional `**/spec.md` fallback is worse: it conceals a mislocated OpenSpec artifact. An SDD-specific checker remains responsible for verifying the SDD's own expected artifact placement.

### Neutral scope and ownership model

Replace `--change <name>` with `--scope <name>`. With no selection, validation sees baseline plus all discovered named scopes while `run` executes only baseline; with selection, both validate baseline plus selected scope, and `run` executes only selected scope. `--scenario` continues to narrow execution, not validation. A named scope is absent if it matches no documents, empty if it matches documents but no focused scenarios; either fails if selected or discovered. A genuinely empty baseline remains a valid zero-scenario result and never claims PASS. No special treatment of OpenSpec `archive/`, filenames or headers; projects exclude archives in their patterns if matched.

Keep per-document parse locations, then validate unique IDs within baseline, within each named scope, and among newly introduced IDs across all discovered scopes when no scope is selected. `- **REVISES**: baseline` is an optional, exactly-once scenario row allowed only in a named scope whose baseline has that same ID; duplicate/malformed rows and an absent baseline owner fail. Multiple scopes can propose different revisions of the same baseline ID, but both cannot introduce the same new ID. The row never changes the target selection or invents evidence. Remove `SpecOperation` from the parser/model and never use `ADDED/MODIFIED/REMOVED` headers to grant identity rights. OpenSpec's delta operation headings remain in its Markdown for OpenSpec's own consumption; repeated baseline scenarios in a full `MODIFIED Requirement` must carry `REVISES` until the delta is archived into baseline, where revision markers must be removed.

**Alternative:** infer revisions from OpenSpec headings or content equality. This gives OpenSpec privileged semantics, or accepts accidental ID reuse. Explicit scenario-level intent works equally in companion docs.

### Results, safety and migration

Text and JSON results say `baseline` and `scope`. The JSON contract becomes `validationScope: { baseline: true, scopes: { mode: 'all' } | { mode: 'selected', name } }` and `executionSelection: { source: 'baseline' | 'scope', scope?: string, scenario?: string }`; preserve `executionStarted`, `valid`, counts, result statuses and errors. `--scope` input must not become a filesystem glob or escape hatch. `src/config.ts` rejects version 1 and legacy `source`/`paths`/`root`; bump the version rather than interpreting the same number as two incompatible schemas. `src/validate.ts` applies structural checks first, resolves concrete runner targets only after validation, and allows `planned:` only in non-strict named-scope planning. No runner protocol changes; one real resolved target still executes once.

**Alternative:** retain `--change`, accept `version: 1`, or add aliases. Those obscure which semantics a caller receives and leave an unbounded compatibility surface during the breaking cutover.

## Risks / Trade-offs

- A chosen native SDD document can contain no focused blocks, or incidental `#### Scenario:` headings lacking ID/evidence. Fail with actionable diagnostics; point users to explicitly configured companion Markdown rather than guessing evidence.
- Broad globs may accidentally include archive/history, duplicate documents, or symlinks outside the root. Require explicit exclusions and detect overlaps/escapes before treating any scenario as evidence.
- Version-2/CLI/JSON migration is breaking. Migrate repository config, existing specs that repeat baseline IDs, fixtures, eval prompts, skill and all callers atomically; document the YAML/CLI/JSON mapping.
- With no `--scope`, strict `run` checks every discovered scope and can be blocked by still-planned work. Preserve this existing fail-closed policy; non-strict `validate` is the planning check.

## Migration Plan

1. Implement version-2 layout parsing and deterministic document discovery; replace `--change` and result fields, remove old source strategies and operation-based collision logic, implement explicit revision validation.
2. Convert this repository's config to OpenSpec baseline/named patterns, update each repeated baseline ID in active deltas with `REVISES`, and migrate test/eval fixtures, examples, installed skill and docs. Keep actual OpenSpec artifact schema and focused-spec document selection independently valid.
3. Exercise project-local runner evidence and real CLI runs against fixtures for standard/adjacent OpenSpec, Spec Kit and Kiro layouts; verify missing/empty scopes, overlapping globs, revisions and JSON output. Run repository tests and check docs links. Drop migration-only scratch fixtures.
4. At archive/sync, remove `REVISES` rows from newly canonical baseline scenarios; rollback, if necessary, is a whole versioned release/config migration, not silent acceptance of version-1 configuration.

## Open Questions

None. Scope layout is deliberately declarative; a future request for native-format adapters or runtime SDD discovery is a separate capability with its own explicit contract.
