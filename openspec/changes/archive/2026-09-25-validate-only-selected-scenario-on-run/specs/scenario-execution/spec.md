## MODIFIED Requirements

### Requirement: Execution selection
`run` SHALL strictly validate and execute every discovered scope by default or only the scope named with `--scope`; with `--scenario <id>`, it SHALL strictly validate, resolve, and execute only occurrences of that ID in the selected scope(s). A requested scope with no matching documents or a selected ID absent from its scope selection SHALL fail before execution. Text and JSON results SHALL report the actual validation and execution selections, including the selected scenario when present. Every scenario result SHALL include its scope; multi-scope text output SHALL display the scope so repeated IDs are unambiguous.

#### Scenario: Default execution includes and distinguishes all scopes
- **ID**: `execution.selection.current`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs all scopes and disambiguates repeated scenario IDs`
- **WHEN** run is called without a scope name or scenario ID and multiple scopes contain valid revisions sharing one ID
- **THEN** every occurrence executes and its result identifies the owning scope

#### Scenario: Scope and scenario selection
- **ID**: `execution.selection.change-scenario`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports selected scope and scenario execution independently of validation scope`
- **WHEN** run selects one scenario inside one explicit scope
- **THEN** it validates and executes only that scenario and reports both selections

#### Scenario: Repeated ID selects every matching scope
- **ID**: `execution.selection.shared-id`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates and runs every matching scope for a selected scenario ID`
- **WHEN** run selects one scenario ID across multiple scopes without `--scope`
- **THEN** it strictly validates and executes each matching occurrence without executing other scenario IDs

#### Scenario: Missing selected scenario does not start execution
- **ID**: `execution.selection.missing-scenario`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a missing selected scenario before resolving evidence`
- **WHEN** run selects a scenario ID absent from its selected scope(s)
- **THEN** it reports the missing scenario and `executionStarted: false` without resolving other evidence or claiming PASS

#### Scenario: Missing selected scope does not start execution
- **ID**: `execution.selection.missing-scope`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > refuses to execute a named scope without documents`
- **WHEN** run explicitly selects a scope with no documents in the configured layout
- **THEN** it reports a missing-scope violation and `executionStarted: false` without claiming PASS

### Requirement: Single strict resolution for run
`run` SHALL resolve concrete evidence for exactly its strict validation selection before any execution and derive the execution plan from those validated targets without resolving them again. With `--scenario`, only evidence from matching scenario instances in the selected scope(s) SHALL resolve; without it, the full selected scope(s) SHALL resolve. Selection SHALL distinguish document scope when IDs repeat, execute only selected unique runner/target pairs, and preserve validation errors from selected scenarios without requiring unrelated scenario evidence to resolve.

#### Scenario: Resolved targets are reused for selected scope
- **ID**: `execution.resolution.reuse`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reuses strict resolution for scoped execution without resolving twice`
- **WHEN** run selects one scope whose concrete evidence requires resolution
- **THEN** each runner resolves its selectors once and only targets from that scope execute

#### Scenario: Selected revision does not resolve source evidence
- **ID**: `execution.resolution.revised-id`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > executes revised evidence rather than source-scope evidence for the same scenario ID`
- **WHEN** a selected-scope revision shares its ID with a source scenario in an unselected scope
- **THEN** only the revision's evidence is resolved and executed while the source is inspected only for ownership

#### Scenario: Scenario filter narrows strict resolution
- **ID**: `execution.resolution.strict-unselected`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** run selects one scenario but concrete evidence in another scenario of the same scope cannot resolve
- **THEN** only selected evidence is resolved and executed; unrelated resolution errors do not block it
