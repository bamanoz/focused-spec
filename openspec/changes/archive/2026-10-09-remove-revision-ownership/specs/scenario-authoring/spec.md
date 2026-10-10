## MODIFIED Requirements

### Requirement: Focused scenario identity
A focused scenario SHALL have one lowercase dotted stable ID unique within its scope. The same ID MAY occur in separate scopes without an owner, revision metadata, or a relationship between scopes. Each occurrence SHALL identify one independently failing outcome and SHALL declare its own evidence. Focused-spec SHALL NOT infer ancestry or inherit evidence from an occurrence in another scope.

#### Scenario: Duplicate stable ID in separate documents
- **ID**: `scenario.identity.duplicate-document`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed shape, unknown runners, and duplicate scoped IDs`
- **WHEN** two specification documents in one scope claim the same scenario ID
- **THEN** validation reports the within-scope duplicate instead of accepting both

#### Scenario: Missing or multiple scenario fields
- **ID**: `scenario.shape.cardinality`
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects scenarios without exactly one ID WHEN and THEN`
- **WHEN** a scenario has zero or multiple ID, WHEN, or THEN rows
- **THEN** validation rejects its shape with an actionable violation

#### Scenario: Independent scopes reuse an identity
- **ID**: `scenario.identity.independent-scopes`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > accepts the same ID in independent scopes without revision metadata`
- **WHEN** separate scopes contain one scenario each with the same stable ID and their own evidence
- **THEN** validation accepts both occurrences without requiring revision metadata or a privileged scope

#### Scenario: Evidence cannot be inherited
- **ID**: `scenario.identity.explicit-evidence`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > does not inherit evidence from another scope with the same ID`
- **WHEN** a selected scenario has no evidence while another scope contains a same-ID scenario with valid evidence
- **THEN** validation rejects the selected scenario rather than inheriting evidence

### Requirement: Native scenario enrollment
A scenario in a configured Markdown document SHALL enter the focused-spec contract if its block contains an ID or EVIDENCE row label, including a malformed row with that label. A scenario without these labels SHALL remain an unenrolled native scenario and SHALL NOT require focused fields, resolve evidence, or receive a focused result. Enrolled scenarios SHALL satisfy the ID, WHEN, THEN, and EVIDENCE rules. WHEN and THEN alone SHALL NOT enroll a scenario.

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
- **EVIDENCE**: `vitest::test/core.spec.ts::focused specification parsing > rejects malformed ID and evidence markers`
- **WHEN** a scenario has a malformed ID or EVIDENCE row label but no valid ID
- **THEN** validation reports the malformed focused metadata and does not ignore the scenario
