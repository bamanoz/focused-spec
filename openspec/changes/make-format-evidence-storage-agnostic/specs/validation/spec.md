# Spec Delta

## MODIFIED Requirements

### Requirement: Validation modes
The CLI SHALL check normalized format-owned evidence, native bindings and scope-local ID uniqueness before resolution, without assuming evidence storage. Full validation SHALL resolve concrete references without executing tests; strict validation SHALL reject planned evidence. Planned references SHALL be permitted in every scope during non-strict planning validation. Syntax-only SHALL validate enrollment without importing runners.

<!-- focused-spec:id=validation.mode.syntax-only -->
#### Scenario: Syntax-only validation does not load runners
- **WHEN** syntax-only validation is requested for a structurally valid scope with an unavailable runner module
- **THEN** validation succeeds without importing that runner or claiming executable targets

<!-- focused-spec:id=validation.mode.counts -->
#### Scenario: Full validation reports resolved and planned counts
- **WHEN** full validation sees concrete and planned evidence across discovered scopes
- **THEN** it reports all scenarios, planned rows, and only unique concrete targets without executing tests

<!-- focused-spec:id=validation.planned.strict-policy -->
#### Scenario: Planned evidence is temporary
- **WHEN** a scope contains only planned evidence
- **THEN** non-strict validation accepts the planning state with zero targets while strict validation rejects it
