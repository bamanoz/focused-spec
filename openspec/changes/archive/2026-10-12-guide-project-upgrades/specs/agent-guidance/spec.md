# Spec Delta

## ADDED Requirements

### Requirement: Actionable obsolete-format guidance
The CLI SHALL reject obsolete configuration and inline focused metadata with a concrete project-local protocol-1 workflow instruction command. Guidance SHALL remain available without loading the obsolete configuration or executing evidence.

<!-- focused-spec:id=guidance.upgrade.obsolete-format -->
#### Scenario: Obsolete formats lead to usable instructions
- **WHEN** a consumer validates version-2 configuration or inline ID/EVIDENCE/REVISES rows with the current CLI
- **THEN** the diagnostic advertises a local instruction command which returns the serving package's complete workflow despite the obsolete project format
