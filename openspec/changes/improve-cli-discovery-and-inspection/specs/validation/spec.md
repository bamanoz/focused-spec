# Spec Delta

## ADDED Requirements

### Requirement: Scenario-filtered standalone validation
`validate --scenario <id>` SHALL select the same exact scope-local occurrences as run, retaining syntax-only, non-strict and strict behavior. Output SHALL report the actual scenario-filtered validation scope. Without the filter, validation SHALL retain full selected-scope behavior. Missing explicit scope/ID and structural source failures SHALL remain errors.

<!-- focused-spec:id=validation.selection.scenario -->
#### Scenario: Selected validation excludes unrelated semantic failures
- **WHEN** a selected occurrence is valid while unrelated occurrences contain malformed or unresolved evidence
- **THEN** standalone validation resolves only selected evidence without executing tests, reports the exact selection and ignores unrelated semantic failures
- **AND** without an explicit scope every matching same-ID occurrence is independently selected; an explicit scope isolates other scopes

<!-- focused-spec:id=validation.selection.modes -->
#### Scenario: Selection preserves validation modes and boundaries
- **WHEN** selected validation uses syntax-only, non-strict or strict mode with planned evidence or an unavailable runner
- **THEN** syntax-only never loads the runner, non-strict accepts planned evidence, and strict rejects selected planned evidence
- **AND** selected malformed evidence, an absent requested ID/scope and structural source errors fail; removing the scenario filter restores full selected-scope checks
