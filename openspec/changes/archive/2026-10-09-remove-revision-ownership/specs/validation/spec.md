## RENAMED Requirements

- FROM: `### Requirement: Repository-wide scenario ownership`
- TO: `### Requirement: Scope-local scenario identity`

## MODIFIED Requirements

### Requirement: Scope-local scenario identity
Stable IDs SHALL be unique within each scope. The same ID in different scopes SHALL be valid without ownership or revision links. Validation SHALL NOT depend on another scope's same-ID occurrence, its continued discovery, or its evidence.

#### Scenario: Same identity in independent scopes
- **ID**: `validation.identity.independent-scopes`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > accepts the same ID in independent scopes without revision metadata`
- **WHEN** different scopes independently contain the same stable ID
- **THEN** validation accepts both while retaining scope-local duplicate checks

### Requirement: Validation modes
The CLI SHALL check scenario shape and scope-local ID uniqueness before resolution. Full validation SHALL resolve concrete evidence without executing tests; strict validation SHALL reject planned evidence. Planned evidence SHALL be permitted in every scope during non-strict planning validation.

#### Scenario: Syntax-only validation does not load runners
- **ID**: `validation.mode.syntax-only`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates scenario structure without importing runner modules in syntax only mode`
- **WHEN** syntax-only validation is requested for a structurally valid scope with an unavailable runner module
- **THEN** validation succeeds without importing that runner or claiming executable targets

#### Scenario: Full validation reports resolved and planned counts
- **ID**: `validation.mode.counts`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** full validation sees concrete and planned evidence across discovered scopes
- **THEN** it reports all scenarios, planned rows, and only unique concrete targets without executing tests

#### Scenario: Planned evidence is temporary
- **ID**: `validation.planned.strict-policy`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > allows planned evidence in every scope only during non-strict validation`
- **WHEN** a scope contains only planned evidence
- **THEN** non-strict validation accepts the planning state with zero targets while strict validation rejects it

### Requirement: Validation before selected execution
Run SHALL strictly validate exactly its selection before starting tests: all discovered scopes without --scope, or only the explicitly named scope with it; when --scenario is present, only occurrences of that ID in the selected scopes SHALL have their shape, scope-local uniqueness, and evidence validated and resolved. An explicitly requested scope with no matching documents or a selected ID absent from its scope selection SHALL fail before execution. Same-ID occurrences in unselected scopes SHALL NOT create validation dependencies. Without --scenario, full-scope validation remains unchanged.

#### Scenario: Unrelated invalid scenario does not block selected run
- **ID**: `validation.scope.unselected-error`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** a selected scenario has executable evidence while another scenario in its scope has malformed, planned, or unresolved evidence
- **THEN** run executes the selected scenario without resolving the unrelated evidence

#### Scenario: Selected scenario retains strict checks
- **ID**: `validation.scope.selected-own-errors`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid selected scenario before execution`
- **WHEN** the selected scenario itself has malformed or planned evidence
- **THEN** run reports its violation and does not start tests

#### Scenario: Explicit scope excludes unrelated evidence failures
- **ID**: `validation.scope.selected-only`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates only the selected scope evidence`
- **WHEN** a selected scope is valid while an unselected scope contains malformed or unresolved evidence
- **THEN** validation and execution of the selected scope are not blocked by the unrelated evidence

### Requirement: Transparent partial adoption
Full validation and execution SHALL apply focused shape, scope-local uniqueness, evidence resolution, and status only to enrolled scenarios. They SHALL separately report unenrolled native scenarios in the selected document scopes without counting them as validated, executed, or passed. A scenario-filtered run SHALL NOT imply coverage of other enrolled or native scenarios.

#### Scenario: Mixed document reports partial adoption
- **ID**: `validation.enrollment.partial-coverage`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports unenrolled native outcomes separately from passing evidence`
- **WHEN** validation and run select one native scenario and one enrolled scenario whose evidence passes
- **THEN** each reports one unenrolled scenario and only the enrolled scenario receives PASS

#### Scenario: Filtered run does not certify native history
- **ID**: `validation.enrollment.selected-coverage`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > distinguishes selected evidence from unenrolled scenarios`
- **WHEN** run selects one enrolled ID in a scope containing additional native scenarios
- **THEN** the result reports the selected ID and unenrolled count without a PASS claim for native scenarios
