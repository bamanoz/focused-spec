# validation Specification

## Purpose

Native binding, registry, scope-local identity, and evidence resolution before execution.

## Requirements

### Requirement: Validation modes
The CLI SHALL check native bindings and registry shape and scope-local ID uniqueness before resolution. Full validation SHALL resolve concrete evidence without executing tests; strict validation SHALL reject planned evidence. Planned evidence SHALL be permitted in every scope during non-strict planning validation.

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

