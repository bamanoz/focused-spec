## ADDED Requirements

### Requirement: Native scenario enrollment
A scenario in a configured Markdown document SHALL enter the focused-spec contract if its block contains an `ID`, `EVIDENCE`, or `REVISES` row label, including a malformed row with that label. A scenario without any of these labels SHALL remain an unenrolled native scenario and SHALL NOT require focused fields, resolve evidence, or receive a focused result. Enrolled scenarios SHALL satisfy the existing ID, WHEN, THEN, EVIDENCE, and revision rules. WHEN and THEN alone SHALL NOT enroll a scenario.

#### Scenario: Native and enrolled outcomes share one document
- **ID**: `scenario.enrollment.mixed-document`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs enrolled outcomes beside untouched native scenarios`
- **WHEN** a configured document contains a native scenario without focused metadata and a valid enrolled scenario
- **THEN** only the enrolled scenario is validated and executed while the native scenario remains unchanged and receives no PASS

#### Scenario: Evidence without ID cannot disappear
- **ID**: `scenario.enrollment.evidence-without-id`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects evidence without a scenario ID in a mixed document`
- **WHEN** a scenario contains an EVIDENCE row but no ID row
- **THEN** validation reports the missing ID rather than treating that scenario as native

#### Scenario: Malformed enrollment marker cannot downgrade a scenario
- **ID**: `scenario.enrollment.malformed-marker`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed ID evidence and revision markers`
- **WHEN** a scenario has a malformed ID, EVIDENCE, or REVISES row label but no valid ID
- **THEN** validation reports the malformed focused metadata and does not ignore the scenario
