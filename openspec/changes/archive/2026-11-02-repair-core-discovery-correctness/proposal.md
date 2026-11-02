# Proposal

## Why

Core discovery and validation currently have several correctness gaps: one document's format-plugin exception can poison subsequent parses, brace-expanded layouts can bypass path safety or assign the wrong captured scope, and `--scope` can repeat filesystem traversal. Migration advice also disagrees with the documented selected-executable workflow, while redundant planning and config coupling add avoidable work and complexity.

## What Changes

- Preserve a format host after a plugin reports a document-specific parse failure; report the failure only for its request and continue processing independent documents.
- Validate every brace-expanded include and exclude alternative as a safe project-relative pattern, and derive captured scopes from the matching expanded layout alternative.
- Discover captured-scope layouts in one glob pass when a scope is selected, retaining overlap and invalid-scope diagnostics.
- Align migration diagnostics with the documented upgrade-topic workflow served by the selected CLI.
- Remove duplicate planning projections, duplicated validation document fields, and confirmed-unused exports/types; move JSON-value validation out of YAML configuration code so runner-facing modules do not depend on configuration parsing.
- Make discovery stages and CLI argument definitions easier to reason about by separating discovery responsibilities and using declarative option metadata, without changing public CLI behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-configuration`: require safe expanded path alternatives, correct scope assignment for brace-expanded captures, and actionable selected-CLI migration guidance.
- `validation`: isolate document-specific format failures and preserve discovery correctness for selected scopes.

## Impact

Core code in `packages/core/src` and its focused regression coverage, plus migration guidance in `docs/guides/configuration.md` and `docs/reference/cli.md` if needed to keep the user-facing contract exact. No public API or CLI grammar change is intended; architecture cleanup is implementation-only. No integrations with OpenSpec or Spec Kit are added.