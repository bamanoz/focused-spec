# scenario-authoring Specification

## Purpose

Focused scenario identity, shape, and evidence references.

## Requirements

### Requirement: Focused scenario identity
A focused scenario SHALL have one repository-unique lowercase dotted stable ID. Independent outcomes SHALL use independent scenarios.

#### Scenario: Duplicate stable ID in separate documents
- **ID**: `scenario.identity.duplicate-document`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed shape, unknown runners, and duplicate ownership`
- **WHEN** two specification documents claim the same scenario ID
- **THEN** validation reports duplicate ownership instead of accepting both

#### Scenario: Missing or multiple scenario fields
- **ID**: `scenario.shape.cardinality`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects scenarios without exactly one ID WHEN and THEN`
- **WHEN** a scenario has zero or multiple ID, WHEN, or THEN rows
- **THEN** validation rejects its shape with an actionable violation

### Requirement: Evidence rows
Each scenario SHALL name at least one evidence reference in the form `[planned:]<runner-id>::<opaque selector>`. Every authored evidence row SHALL be preserved for validation and multiple rows form an AND contract.

#### Scenario: Missing evidence
- **ID**: `scenario.evidence.required`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects a scenario without evidence`
- **WHEN** a scenario declares no EVIDENCE row
- **THEN** validation rejects the scenario rather than treating it as proved

#### Scenario: Malformed evidence alongside valid evidence
- **ID**: `scenario.evidence.malformed-row`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects malformed evidence rows rather than passing on the remaining evidence`
- **WHEN** a scenario contains a valid EVIDENCE row and another EVIDENCE row without its required syntax
- **THEN** run fails validation at the malformed row before reporting any PASS

#### Scenario: Opaque selector retains its internal separators
- **ID**: `scenario.evidence.opaque-selector`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > parses a focused scenario and opaque runner selector`
- **WHEN** an evidence reference contains additional `::` within its selector
- **THEN** the reference is split only at the first `::` and the remaining selector is preserved