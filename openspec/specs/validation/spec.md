# validation Specification

## Purpose

Structure, ownership, resolution, and scope validation before execution.

## Requirements

### Requirement: Validation modes
The CLI SHALL check scenario shape and ownership before resolution. Full validation SHALL resolve concrete evidence without executing tests; strict validation SHALL reject planned evidence. Planned evidence SHALL be permitted in every scope during non-strict planning validation.

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

### Requirement: Repository-wide scenario ownership
Stable IDs SHALL be unique within each scope. Across scopes, repeated IDs SHALL form a revision graph with exactly one unmarked owner: every other occurrence SHALL name an existing same-ID scenario in another scope, and every chain SHALL reach the owner without a self-reference or cycle. Two scopes MAY independently revise one source. An OpenSpec section heading or the name `baseline` SHALL not implicitly grant ownership.

#### Scenario: Same new ID in two scopes
- **ID**: `validation.identity.cross-change`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unmarked ID reuse across captured scopes`
- **WHEN** two scopes introduce the same ID without either declaring a revision source
- **THEN** validation rejects the competing unmarked owners and identifies both scopes

#### Scenario: Scope reuses another scope's ID without REVISES
- **ID**: `validation.identity.current-owner`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unmarked ID reuse from another scope`
- **WHEN** a scenario claims an ID already owned by another scope without a revision marker
- **THEN** validation rejects the collision without invalidating legitimate explicitly marked revisions

#### Scenario: Section heading does not authorize ID reuse
- **ID**: `validation.identity.no-heading-privilege`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unmarked ID reuse under an OpenSpec MODIFIED heading`
- **WHEN** a scenario reuses another scope's ID under an OpenSpec MODIFIED or REMOVED heading without a REVISES row
- **THEN** validation rejects ID reuse just as it would in any other Markdown layout

### Requirement: Validation before selected execution
`run` SHALL strictly validate exactly its selection before starting tests: all discovered scopes without `--scope`, or only the explicitly named scope with it; when `--scenario <id>` is present, only occurrences of that ID in the selected scope(s) SHALL have their scenario shape and evidence strictly validated and resolved. An explicitly requested scope with no matching documents or a selected scenario ID absent from its scope selection SHALL fail before execution. Ownership checks SHALL still verify the selected ID and its revision chain across scopes without resolving unselected evidence. Malformed or unresolved evidence in other scenarios SHALL NOT prevent selected-scenario execution. Without `--scenario`, full-scope validation remains unchanged.

#### Scenario: Unrelated invalid scenario does not block selected run
- **ID**: `validation.scope.unselected-error`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** a selected scenario has valid executable evidence while another scenario in the same scope has malformed, planned, or unresolved evidence
- **THEN** run executes the selected scenario without validating or resolving the unrelated evidence

#### Scenario: Selected scenario retains strict checks
- **ID**: `validation.scope.selected-own-errors`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid selected scenario before execution`
- **WHEN** the selected scenario itself has malformed or planned evidence or an orphan REVISES source
- **THEN** run reports its violation and does not start any tests

#### Scenario: Explicit scope excludes unrelated evidence failures
- **ID**: `validation.scope.selected-only`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates only the selected scope evidence`
- **WHEN** a selected scope is structurally valid while an unselected scope contains malformed or unresolved evidence
- **THEN** validation and execution of the selected scope are not blocked by the unrelated evidence

### Requirement: Transparent partial adoption
Full validation and execution SHALL apply focused shape, ownership, evidence resolution, and status only to enrolled scenarios. They SHALL separately report the number of unenrolled native scenarios in the selected document scope(s), including documents containing both kinds of scenarios, without counting native scenarios as validated, executed, or passed. A scenario-filtered run SHALL retain its narrower selection in the result and SHALL NOT imply coverage of other enrolled or native scenarios.

#### Scenario: Mixed document reports partial adoption
- **ID**: `validation.enrollment.partial-coverage`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports unenrolled native outcomes separately from passing evidence`
- **WHEN** full validation and run select a document containing one native scenario and one enrolled scenario whose evidence passes
- **THEN** each result reports one unenrolled scenario and only the enrolled scenario receives a focused PASS

#### Scenario: Filtered run does not certify native history
- **ID**: `validation.enrollment.selected-coverage`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > distinguishes selected evidence from unenrolled scenarios`
- **WHEN** run selects one enrolled ID in a scope containing additional native scenarios
- **THEN** the result identifies the selected ID, reports the scope's unenrolled count, and makes no PASS claim for native scenarios
