# Spec Delta

## MODIFIED Requirements

### Requirement: Actionable obsolete-format guidance
The CLI SHALL reject obsolete config/format APIs, unsupported REVISES and inline metadata selected through a non-inline format with a concrete project-local protocol-1 workflow command. Explicit API-2 inline ID/EVIDENCE SHALL be supported, not reported as obsolete. Guidance SHALL remain available without loading invalid configuration or executing evidence.

<!-- focused-spec:id=guidance.upgrade.obsolete-format -->
#### Scenario: Obsolete formats lead to usable instructions
- **WHEN** a consumer validates config versions 1–4, Format API 1, REVISES, or inline ID/EVIDENCE without selecting the inline adapter
- **THEN** the diagnostic advertises a local instruction command which returns the serving package's complete workflow despite the invalid configuration, API or authoring-format selection
