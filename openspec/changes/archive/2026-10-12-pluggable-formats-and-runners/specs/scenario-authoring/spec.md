# Spec Delta

## ADDED Requirements

### Requirement: Normalized format parsing
Explicit format adapters SHALL return native structural names, positive line locations, direct focused IDs, explicit native IDs and diagnostics without taking ownership of document scope or path. The core SHALL validate returned data before binding evidence. Unknown document extensions SHALL be usable through an explicitly selected adapter.

<!-- focused-spec:id=format.contract.normalized -->
#### Scenario: Third-party native format binds evidence
- **WHEN** a project-relative format adapter parses a document with an extension unknown to the core
- **THEN** its normalized native item binds and executes registered evidence in the core-owned scope

<!-- focused-spec:id=format.contract.malformed -->
#### Scenario: Invalid format results cannot bind evidence
- **WHEN** an adapter returns malformed items, invalid IDs or diagnostics
- **THEN** the core reports a format error without inventing items or executing evidence

### Requirement: Bounded isolated format execution
Format parsing SHALL execute outside the CLI process with bounded lifetimes and output. A selected adapter that hangs synchronously, crashes or fails to export its declared interface SHALL produce an actionable violation rather than hanging the CLI or falling back to another parser.

<!-- focused-spec:id=format.lifecycle.timeout -->
#### Scenario: Non-responsive native parser fails closed
- **WHEN** a selected format adapter blocks its host process beyond its configured timeout
- **THEN** validation terminates the host and returns a format violation without execution
