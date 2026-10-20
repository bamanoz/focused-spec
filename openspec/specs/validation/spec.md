# validation Specification

## Purpose

Native binding, registry, scope-local identity, and evidence resolution before execution.

## Requirements

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

### Requirement: Scope-local scenario identity
Stable IDs SHALL be unique within each scope. The same ID in different scopes SHALL be valid without ownership or revision links. Validation SHALL NOT depend on another scope's same-ID occurrence, its continued discovery, or its evidence.

<!-- focused-spec:id=validation.identity.independent-scopes -->
#### Scenario: Same identity in independent scopes
- **WHEN** different scopes independently contain the same stable ID
- **THEN** validation accepts both while retaining scope-local duplicate checks

### Requirement: Validation before selected execution
Run SHALL strictly validate exactly its selection before starting tests: all discovered scopes without --scope, or only the explicitly named scope with it; when --scenario is present, only occurrences of that ID in the selected scopes SHALL have their native bindings, scope-local uniqueness, and evidence validated and resolved.


<!-- focused-spec:id=validation.scope.unselected-error -->
#### Scenario: Unrelated invalid scenario does not block selected run
- **WHEN** a selected scenario has executable evidence while another scenario in its scope has malformed, planned, or unresolved evidence
- **THEN** run executes the selected scenario without resolving the unrelated evidence
- **AND** An explicitly requested scope with no matching documents or a selected ID absent from its scope selection SHALL fail before execution. Same-ID occurrences in unselected scopes SHALL NOT create validation dependencies. Without --scenario, full-scope validation remains unchanged.

<!-- focused-spec:id=validation.scope.selected-own-errors -->
#### Scenario: Selected scenario retains strict checks
- **WHEN** the selected scenario itself has malformed or planned evidence
- **THEN** run reports its violation and does not start tests

<!-- focused-spec:id=validation.scope.selected-only -->
#### Scenario: Explicit scope excludes unrelated evidence failures
- **WHEN** a selected scope is valid while an unselected scope contains malformed or unresolved evidence
- **THEN** validation and execution of the selected scope are not blocked by the unrelated evidence

### Requirement: Transparent partial adoption
Full validation and execution SHALL apply native binding, scope-local uniqueness, evidence resolution, and status only to enrolled scenarios. They SHALL report registered items and actual evidence results without inventing a count of unregistered native outcomes or claiming host validity. A scenario-filtered run SHALL NOT imply coverage of other enrolled or native scenarios.

<!-- focused-spec:id=validation.enrollment.partial-coverage -->
#### Scenario: Mixed document reports partial adoption
- **WHEN** validation and run select one native scenario and one enrolled scenario whose evidence passes
- **THEN** only the registered item receives PASS and no native coverage count is invented

<!-- focused-spec:id=validation.enrollment.selected-coverage -->
#### Scenario: Filtered run does not certify native history
- **WHEN** run selects one enrolled ID in a scope containing additional native scenarios
- **THEN** the result reports only the selected ID without a PASS claim for unregistered native content


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

### Requirement: Planned prefix does not reserve runner identity
Concrete evidence SHALL permit a configured runner named `planned`. Only a standalone `planned:` prefix before the runner ID SHALL mark deferred evidence. The selector suffix SHALL remain opaque and unchanged.

<!-- focused-spec:id=validation.planned.runner-id -->
#### Scenario: Concrete and deferred references to the planned runner differ
- **WHEN** a configured runner is named planned and evidence uses planned::selector or planned:planned::selector
- **THEN** concrete evidence resolves and executes the exact selector, non-strict validation defers only the prefixed reference and strict validation rejects that deferred reference without executing it
