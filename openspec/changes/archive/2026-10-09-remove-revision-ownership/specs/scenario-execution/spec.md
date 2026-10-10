## MODIFIED Requirements

### Requirement: Execution selection
Run SHALL strictly validate and execute every discovered scope by default or only the explicitly selected scope; with --scenario, it SHALL select occurrences of that ID in the selected scopes. A requested scope with no matching documents or selected ID absent from its selection SHALL fail before execution. Results SHALL report actual validation and execution selections, and every scenario result SHALL include its scope so repeated IDs remain unambiguous. Same-ID occurrences SHALL execute their own explicit evidence without inheritance.

#### Scenario: Default execution includes and distinguishes all scopes
- **ID**: `execution.selection.current`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs all scopes and disambiguates repeated scenario IDs`
- **WHEN** multiple scopes contain independent scenarios sharing one ID and run selects all scopes
- **THEN** every occurrence executes its own evidence and its result identifies its scope

#### Scenario: Scope and scenario selection
- **ID**: `execution.selection.change-scenario`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports selected scope and scenario execution independently of validation scope`
- **WHEN** run selects one scenario inside one explicit scope
- **THEN** it validates and executes only that scenario and reports both selections

#### Scenario: Repeated ID selects every matching scope
- **ID**: `execution.selection.shared-id`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates and runs every matching scope for a selected scenario ID`
- **WHEN** run selects one scenario ID across multiple scopes without --scope
- **THEN** it validates and executes each matching occurrence without executing other IDs

#### Scenario: Missing selected scenario does not start execution
- **ID**: `execution.selection.missing-scenario`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a missing selected scenario before resolving evidence`
- **WHEN** run selects a scenario ID absent from its selected scopes
- **THEN** it reports the missing scenario without resolving evidence or claiming PASS

#### Scenario: Missing selected scope does not start execution
- **ID**: `execution.selection.missing-scope`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > refuses to execute a named scope without documents`
- **WHEN** run explicitly selects a scope with no documents in the configured layout
- **THEN** it reports a missing-scope violation without starting execution or claiming PASS

### Requirement: Single strict resolution for run
Run SHALL resolve concrete evidence for exactly its strict validation selection before execution and derive its execution plan from those validated targets without resolving them again. Selection SHALL distinguish document scope when IDs repeat, execute only selected unique runner/target pairs, and retain validation errors from selected scenarios without resolving unrelated evidence.

#### Scenario: Resolved targets are reused for selected scope
- **ID**: `execution.resolution.reuse`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reuses strict resolution for scoped execution without resolving twice`
- **WHEN** run selects one scope with concrete evidence
- **THEN** each runner resolves its selectors once and only targets from that scope execute

#### Scenario: Same-ID scopes execute independently
- **ID**: `execution.resolution.scoped-id`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > executes only selected-scope evidence for the same scenario ID`
- **WHEN** a selected scope shares an ID with an occurrence in another scope
- **THEN** only the selected scope's evidence resolves and executes without a dependency on the other occurrence

#### Scenario: Scenario filter narrows strict resolution
- **ID**: `execution.resolution.strict-unselected`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** concrete evidence in another scenario of the selected scope cannot resolve
- **THEN** only selected evidence resolves and executes
