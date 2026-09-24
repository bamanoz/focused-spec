## MODIFIED Requirements

### Requirement: Focused scenario identity
A focused scenario SHALL have one repository-unique lowercase dotted stable ID, except that a named-scope scenario MAY explicitly declare `- **REVISES**: baseline` to revise the baseline scenario with that same ID. The marker SHALL be valid only when the baseline contains that ID and SHALL not permit duplicate declarations within a document/scope or two independent scopes to introduce the same new ID. Section headers such as OpenSpec `MODIFIED Requirements` SHALL NOT confer revision rights. Independent outcomes SHALL use independent scenarios.

#### Scenario: Duplicate stable ID in separate documents
- **ID**: `scenario.identity.duplicate-document`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed shape, unknown runners, and duplicate ownership`
- **WHEN** two specification documents in one owner claim the same scenario ID
- **THEN** validation reports duplicate ownership instead of accepting both

#### Scenario: Missing or multiple scenario fields
- **ID**: `scenario.shape.cardinality`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects scenarios without exactly one ID WHEN and THEN`
- **WHEN** a scenario has zero or multiple ID, WHEN, or THEN rows
- **THEN** validation rejects its shape with an actionable violation

#### Scenario: Explicit baseline revision
- **ID**: `scenario.identity.explicit-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > accepts explicit baseline revisions in a named scope`
- **WHEN** a named-scope scenario declares one REVISES baseline row and retains an ID owned by a baseline scenario
- **THEN** validation accepts that revision without using framework-specific headings

#### Scenario: Invalid baseline revision
- **ID**: `scenario.identity.invalid-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects revisions without a baseline owner`
- **WHEN** a named-scope scenario declares REVISES baseline for an ID absent from baseline
- **THEN** validation rejects the orphan revision with its scenario location and ID

#### Scenario: Baseline cannot revise itself
- **ID**: `scenario.identity.baseline-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects revision markers on baseline scenarios`
- **WHEN** a baseline scenario declares a REVISES row
- **THEN** validation rejects the misplaced revision marker

#### Scenario: Ambiguous revision marker
- **ID**: `scenario.identity.malformed-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects malformed and repeated revision markers`
- **WHEN** a named-scope scenario declares malformed or repeated REVISES rows
- **THEN** validation rejects the ambiguous revision instead of allowing ID reuse

### Requirement: Evidence rows
Each scenario SHALL name at least one evidence reference in the form `[planned:]<runner-id>::<opaque selector>`. Every authored evidence row SHALL be preserved for validation and multiple rows form an AND contract.

#### Scenario: Missing evidence
- **ID**: `scenario.evidence.required`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects a scenario without evidence`
- **WHEN** a scenario declares no EVIDENCE row
- **THEN** validation rejects the scenario rather than treating it as proved

#### Scenario: Malformed evidence alongside valid evidence
- **ID**: `scenario.evidence.malformed-row`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects malformed evidence rows rather than passing on the remaining evidence`
- **WHEN** a scenario contains a valid EVIDENCE row and another EVIDENCE row without its required syntax
- **THEN** run fails validation at the malformed row before reporting any PASS

#### Scenario: Opaque selector retains its internal separators
- **ID**: `scenario.evidence.opaque-selector`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > parses a focused scenario and opaque runner selector`
- **WHEN** an evidence reference contains additional `::` within its selector
- **THEN** the reference is split only at the first `::` and the remaining selector is preserved
