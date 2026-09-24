## 1. Versioned document layout

- [x] 1.1 Replace version-1 `specifications.source` config types/parsing with version-2 `specifications.documents` entries (`match`, optional `exclude`, baseline or single `{scope}` capture); reject legacy keys, unsafe paths, malformed captures and non-Markdown matches before file IO.
- [x] 1.2 Replace OpenSpec-specific source loading with deterministic project-contained baseline/scope discovery; support adjacent, nested and fixed-prefix scope capture, per-entry exclusions and multiple entries per scope; diagnose overlapping files and missing/empty named scopes.

## 2. Scenario ownership and CLI

- [x] 2.1 Parse and validate exactly zero or one `REVISES: baseline` rows per scenario; require a baseline ID owner, reject markers in baseline, and remove operation-header-based ownership while retaining one ID, one WHEN/THEN and all evidence rows.
- [x] 2.2 Validate baseline plus all scopes by default or baseline plus only `--scope` selection; preserve planned-evidence policy, cross-scope new-ID uniqueness, complete-scope checks before selected execution and real evidence resolution.
- [x] 2.3 Replace `--change` with `--scope` throughout CLI and public result types; emit neutral validation/execution JSON and text fields, preserve `executionStarted: false` on missing scope and existing PASS/FAIL/SKIP/ERROR rules.

## 3. Consumer migration and behavioral proof

- [x] 3.1 Migrate repository `.focused-spec/config.yaml` to version 2, old fixture configs and CLI callers/tests, examples and eval workspaces; replace all repeated baseline scenario IDs in active deltas with explicit REVISES markers, without changing SDD framework artifacts to hide placement errors.
- [x] 3.2 Implement the exact Vitest selectors named by all `planned:` delta evidence as consumer-observable checks of layouts, absent/empty/overlapping scopes, unsafe config, explicit/malformed revisions, selected-scope validation isolation and JSON execution context; migrate existing affected test selectors/evidence and remove obsolete assertions rather than pinning old names.
- [x] 3.3 Exercise the actual CLI plus project-local Vitest runner against disposable standard/adjacent OpenSpec, Spec Kit, Kiro and BMad-style layouts with focused scenarios or explicitly configured companions; prove one passing target and a controlled failing target, and that native prose alone never yields a false PASS.

## 4. Documentation and verification

- [x] 4.1 Update `docs/guides/configuration.md`, `docs/reference/cli.md`, affected concepts/guides, `skills/focused-spec/SKILL.md`, and migration examples with exact YAML v2/`--scope`/JSON/revision contracts; verify docs navigation links without duplicating normative owners.
- [x] 4.2 Replace every `planned:` row in this change with a real selector after its test exists; run `npm test`, `openspec validate make-spec-discovery-framework-neutral --strict --no-interactive`, `focused-spec validate --scope make-spec-discovery-framework-neutral --strict`, and `focused-spec run --scope make-spec-discovery-framework-neutral`; report actual outcomes and any optional eval limitations before syncing/archiving.
