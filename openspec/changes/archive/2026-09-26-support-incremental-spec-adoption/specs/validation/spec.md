## ADDED Requirements

### Requirement: Transparent partial adoption
Full validation and execution SHALL apply focused shape, ownership, evidence resolution, and status only to enrolled scenarios. They SHALL separately report the number of unenrolled native scenarios in the selected document scope(s), including documents containing both kinds of scenarios, without counting native scenarios as validated, executed, or passed. A scenario-filtered run SHALL retain its narrower selection in the result and SHALL NOT imply coverage of other enrolled or native scenarios.

#### Scenario: Mixed document reports partial adoption
- **ID**: `validation.enrollment.partial-coverage`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports unenrolled native outcomes separately from passing evidence`
- **WHEN** full validation and run select a document containing one native scenario and one enrolled scenario whose evidence passes
- **THEN** each result reports one unenrolled scenario and only the enrolled scenario receives a focused PASS

#### Scenario: Filtered run does not certify native history
- **ID**: `validation.enrollment.selected-coverage`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > distinguishes selected evidence from unenrolled scenarios`
- **WHEN** run selects one enrolled ID in a scope containing additional native scenarios
- **THEN** the result identifies the selected ID, reports the scope's unenrolled count, and makes no PASS claim for native scenarios
