## MODIFIED Requirements

### Requirement: Repository-wide scenario ownership
Baseline scenarios SHALL own their stable IDs; new IDs across named scopes SHALL not collide. A named-scope scenario SHALL retain a baseline ID only by explicitly declaring a revision of that baseline ID. A revision without an owner SHALL fail, including in a project without baseline documents; an OpenSpec section heading SHALL not implicitly grant ownership.

#### Scenario: Same new ID in two named scopes
- **ID**: `validation.identity.cross-change`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects duplicate IDs introduced by separate active changes`
- **WHEN** two named scopes introduce the same new stable ID
- **THEN** validation rejects the duplicate and identifies the conflicting owner

#### Scenario: New scope scenario reuses a baseline ID
- **ID**: `validation.identity.current-owner`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects an added change that steals a current scenario ID`
- **WHEN** a named-scope scenario claims an ID already owned by the baseline without a revision marker
- **THEN** validation rejects the scope without invalidating legitimate explicitly marked revisions

#### Scenario: Section heading does not authorize ID reuse
- **ID**: `validation.identity.no-heading-privilege`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unmarked ID reuse under an OpenSpec MODIFIED heading`
- **WHEN** a named-scope scenario reuses a baseline ID under an OpenSpec MODIFIED or REMOVED heading without a REVISES row
- **THEN** validation rejects ID reuse just as it would in any other Markdown layout

### Requirement: Validation before selected execution
`run` SHALL strictly validate the complete baseline-plus-selected-scope before selecting tests; with no selected scope it SHALL validate the baseline and all discovered named scopes before selecting baseline tests. `--scenario` SHALL narrow execution only, not validation. An explicitly requested scope with no matching documents SHALL fail before test execution; unrelated named scopes SHALL not block a selected scope's execution.

#### Scenario: Error in an unselected scenario blocks execution
- **ID**: `validation.scope.unselected-error`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > attributes an unselected scenario error to validation before execution`
- **WHEN** a selected scenario would pass but another scenario in the validation scope has unresolved evidence
- **THEN** run reports validation failure and does not start the selected scenario

#### Scenario: Explicit scope excludes unrelated scopes
- **ID**: `validation.scope.selected-only`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates baseline and selected scope without unrelated scopes`
- **WHEN** one unrelated scope contains invalid evidence while a selected scope and baseline are valid
- **THEN** validation and execution of the selected scope are not blocked by the unrelated scope

### Requirement: Validation modes
The CLI SHALL check scenario shape and ownership before resolution. Full validation SHALL resolve concrete evidence without executing tests; strict validation SHALL reject planned evidence. Planned evidence SHALL be permitted only in named scopes during non-strict planning validation; baseline evidence SHALL remain concrete even when a scope is selected.

#### Scenario: Syntax-only validation does not load runners
- **ID**: `validation.mode.syntax-only`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates scenario structure without importing runner modules in syntax only mode`
- **WHEN** syntax-only validation is requested for a structurally valid scope with an unavailable runner module
- **THEN** validation succeeds without importing that runner or claiming executable targets

#### Scenario: Full validation reports resolved and planned counts
- **ID**: `validation.mode.counts`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** full validation sees baseline evidence and planned named-scope evidence
- **THEN** it reports all scenarios, planned rows, and only unique concrete targets without executing tests

#### Scenario: Planned evidence is temporary
- **ID**: `validation.planned.strict-policy`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > counts an all-planned change without inventing executable targets`
- **WHEN** a named scope contains only planned evidence
- **THEN** non-strict validation accepts the planning state with zero targets while strict validation rejects it
