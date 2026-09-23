# validation Specification

## Purpose

Structure, ownership, resolution, and scope validation before execution.

## Requirements

### Requirement: Validation modes
The CLI SHALL check scenario shape and ownership before resolution. Full validation SHALL resolve concrete evidence without executing tests; strict validation SHALL reject planned evidence.

#### Scenario: Syntax-only validation does not load runners
- **ID**: `validation.mode.syntax-only`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates scenario structure without importing runner modules in syntax only mode`
- **WHEN** syntax-only validation is requested for a structurally valid change with an unavailable runner module
- **THEN** validation succeeds without importing that runner or claiming executable targets

#### Scenario: Full validation reports resolved and planned counts
- **ID**: `validation.mode.counts`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** full validation sees current evidence and planned change evidence
- **THEN** it reports all scenarios, planned rows, and only unique concrete targets without executing tests

#### Scenario: Planned evidence is temporary
- **ID**: `validation.planned.strict-policy`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > counts an all-planned change without inventing executable targets`
- **WHEN** a change contains only planned evidence
- **THEN** non-strict validation accepts the planning state with zero targets while strict validation rejects it

### Requirement: Repository-wide scenario ownership
Current scenarios SHALL own their stable IDs; new IDs across active changes SHALL not collide. A modification or removal MAY retain its current scenario ID.

#### Scenario: Same new ID in two active changes
- **ID**: `validation.identity.cross-change`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects duplicate IDs introduced by separate active changes`
- **WHEN** two active changes introduce the same new stable ID
- **THEN** validation rejects the duplicate and identifies the conflicting owner

#### Scenario: Added change reuses a current ID
- **ID**: `validation.identity.current-owner`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects an added change that steals a current scenario ID`
- **WHEN** an ADDED change scenario claims an ID already owned by a current scenario
- **THEN** validation rejects the change without invalidating legitimate MODIFIED ownership

### Requirement: Validation before selected execution
`run` SHALL validate the complete current-plus-selected-change scope before selecting tests. `--scenario` SHALL narrow execution only, not validation.

#### Scenario: Error in an unselected scenario blocks execution
- **ID**: `validation.scope.unselected-error`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > attributes an unselected scenario error to validation before execution`
- **WHEN** a selected scenario would pass but another scenario in the validation scope has unresolved evidence
- **THEN** run reports validation failure and does not start the selected scenario
