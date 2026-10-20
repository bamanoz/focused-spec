# Spec Delta

## Purpose

Own the explicitly selected inline Markdown authoring dialect that enrolls one native scenario with its stable identity and exact executable evidence without a separate evidence file.

## ADDED Requirements

### Requirement: Inline scenario enrollment
The official inline format SHALL enroll level-four Scenario headings with their own ID, EVIDENCE, WHEN and THEN rows. Each scenario SHALL require one ID, at least one EVIDENCE and exactly one WHEN and THEN. Evidence SHALL come from that scenario, without reading or generating a separate registry.

<!-- focused-spec:id=inline.authoring.execution -->
#### Scenario: Inline evidence executes without a registry
- **WHEN** the selected inline format parses a scenario with two concrete EVIDENCE rows and no evidence file exists
- **THEN** the normal CLI resolves and executes both exact references, reports the original ID and scope, and passes only when both targets pass
- **AND** opaque selector suffixes and reference order are preserved without a YAML intermediate

### Requirement: Inline metadata errors
The inline format SHALL diagnose missing, duplicate, detached and malformed metadata instead of silently omitting scenarios or references. Diagnostics SHALL identify their real source coordinates and a known focused identity when available.

<!-- focused-spec:id=inline.authoring.metadata-errors -->
#### Scenario: Invalid metadata cannot disappear
- **WHEN** a declared inline scenario has duplicate ID rows, missing WHEN or THEN, missing EVIDENCE, or a malformed EVIDENCE row beside a valid one
- **THEN** validation fails at that metadata and no evidence execution begins

<!-- focused-spec:id=inline.authoring.provenance -->
#### Scenario: Metadata failures retain document provenance
- **WHEN** an enrolled inline scenario declares an invalid selected evidence reference
- **THEN** the error identifies its document and metadata line rather than a fabricated registry path

### Requirement: Literal examples remain unenrolled
Scenario and metadata examples inside fenced code, indented code or block quotes SHALL NOT enroll executable outcomes. Real scenario metadata SHALL remain local to its owning scenario and SHALL NOT be borrowed across scenario or section boundaries.

<!-- focused-spec:id=inline.authoring.literal-examples -->
#### Scenario: Literal inline examples do not run
- **WHEN** a document contains code or quoted examples with ID and EVIDENCE rows beside one real inline scenario
- **THEN** only the real scenario is enrolled and literal example references are not resolved

### Requirement: Inline identity has no ancestry
Inline ID values SHALL retain the core's opaque identity semantics. REVISES SHALL be rejected as unsupported metadata, without ownership, revision-chain validation or evidence inheritance.

<!-- focused-spec:id=inline.authoring.no-revises -->
#### Scenario: REVISES cannot create ancestry
- **WHEN** an inline scenario contains a REVISES row
- **THEN** the inline adapter reports unsupported metadata instead of ignoring it or deriving evidence from another scope

<!-- focused-spec:id=inline.authoring.selected-isolation -->
#### Scenario: Selection does not inherit or borrow inline evidence
- **WHEN** a selected valid inline occurrence shares its ID with another scope and unrelated inline metadata is semantically invalid
- **THEN** it executes only its own evidence while full validation reports the unrelated errors and an occurrence lacking its own evidence cannot inherit it

### Requirement: Inline planned evidence uses ordinary validation
Inline planned references SHALL follow the existing strict/non-strict policy. Syntax-only SHALL validate parsed enrollment and references without loading runners; strict validation and run SHALL reject selected planned evidence.

<!-- focused-spec:id=inline.authoring.planned-policy -->
#### Scenario: Planned inline evidence does not claim execution
- **WHEN** an inline scenario contains planned evidence and its runner module is unavailable
- **THEN** syntax-only and non-strict validation accept planning with no runner import or executable target claim, while strict validation and run reject the selected planned reference
