# scenario-authoring Specification

## Purpose

Focused scenario identity, shape, and evidence references.

## Requirements

### Requirement: Focused scenario identity
A focused scenario SHALL have one lowercase dotted stable ID that is unique within its scope. Across scopes, the same ID MAY appear only when exactly one occurrence is the unmarked owner and every other occurrence has exactly one `- **REVISES**: <source-scope>` row naming an existing same-ID scenario in another scope. Revision chains SHALL reach that owner without self-references or cycles; multiple scopes MAY independently revise one source. Section headers such as OpenSpec `MODIFIED Requirements` and scope names such as `baseline` SHALL NOT confer revision rights. Independent outcomes SHALL use independent scenarios.

#### Scenario: Duplicate stable ID in separate documents
- **ID**: `scenario.identity.duplicate-document`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed shape, unknown runners, and duplicate ownership`
- **WHEN** two specification documents in one scope claim the same scenario ID
- **THEN** validation reports the within-scope duplicate instead of accepting both

#### Scenario: Missing or multiple scenario fields
- **ID**: `scenario.shape.cardinality`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects scenarios without exactly one ID WHEN and THEN`
- **WHEN** a scenario has zero or multiple ID, WHEN, or THEN rows
- **THEN** validation rejects its shape with an actionable violation

#### Scenario: Explicit cross-scope revision
- **ID**: `scenario.identity.explicit-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > accepts revisions from an unselected source without resolving its evidence`
- **WHEN** a scenario keeps an ID from another scope and declares one REVISES row naming that same-ID source scope
- **THEN** validation accepts the revision without using framework-specific headings or privileged scope names

#### Scenario: Baseline is an ordinary source name
- **ID**: `scenario.identity.baseline-ordinary`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > treats baseline as an ordinary revision source name`
- **WHEN** a scope named baseline owns an ID and a different scope explicitly revises it
- **THEN** validation accepts the relationship by the same rules as every other pair of scope names

#### Scenario: Revision source does not own the ID
- **ID**: `scenario.identity.invalid-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects revisions without an owning source scope`
- **WHEN** a scenario declares REVISES for a source scope that has no scenario with the same ID
- **THEN** validation rejects the orphan revision with its location, ID, and source scope

#### Scenario: Scope cannot revise itself
- **ID**: `scenario.identity.baseline-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects revisions from the same scope`
- **WHEN** a scenario declares its own scope in a REVISES row
- **THEN** validation rejects the self-reference rather than treating the scope name specially

#### Scenario: Ambiguous revision marker
- **ID**: `scenario.identity.malformed-revision`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects malformed and repeated revision markers`
- **WHEN** a scenario declares malformed or repeated REVISES rows
- **THEN** validation rejects the ambiguous revision instead of allowing ID reuse

#### Scenario: Revision cycle has no owner
- **ID**: `scenario.identity.revision-cycle`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects cyclic revision ownership`
- **WHEN** every occurrence of one ID revises another occurrence and their links form a cycle
- **THEN** validation rejects the cycle because no chain reaches one unmarked owner

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

### Requirement: Native scenario enrollment
A scenario in a configured Markdown document SHALL enter the focused-spec contract if its block contains an `ID`, `EVIDENCE`, or `REVISES` row label, including a malformed row with that label. A scenario without any of these labels SHALL remain an unenrolled native scenario and SHALL NOT require focused fields, resolve evidence, or receive a focused result. Enrolled scenarios SHALL satisfy the existing ID, WHEN, THEN, EVIDENCE, and revision rules. WHEN and THEN alone SHALL NOT enroll a scenario.

#### Scenario: Native and enrolled outcomes share one document
- **ID**: `scenario.enrollment.mixed-document`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs enrolled outcomes beside untouched native scenarios`
- **WHEN** a configured document contains a native scenario without focused metadata and a valid enrolled scenario
- **THEN** only the enrolled scenario is validated and executed while the native scenario remains unchanged and receives no PASS

#### Scenario: Evidence without ID cannot disappear
- **ID**: `scenario.enrollment.evidence-without-id`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects evidence without a scenario ID in a mixed document`
- **WHEN** a scenario contains an EVIDENCE row but no ID row
- **THEN** validation reports the missing ID rather than treating that scenario as native

#### Scenario: Malformed enrollment marker cannot downgrade a scenario
- **ID**: `scenario.enrollment.malformed-marker`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed ID evidence and revision markers`
- **WHEN** a scenario has a malformed ID, EVIDENCE, or REVISES row label but no valid ID
- **THEN** validation reports the malformed focused metadata and does not ignore the scenario
