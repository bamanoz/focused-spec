## ADDED Requirements

### Requirement: Planned prefix does not reserve runner identity
Concrete evidence SHALL permit a configured runner named `planned`. Only a standalone `planned:` prefix before the runner ID SHALL mark deferred evidence. The selector suffix SHALL remain opaque and unchanged.

<!-- focused-spec:id=validation.planned.runner-id -->
#### Scenario: Concrete and deferred references to the planned runner differ
- **WHEN** a configured runner is named planned and evidence uses planned::selector or planned:planned::selector
- **THEN** concrete evidence resolves and executes the exact selector, non-strict validation defers only the prefixed reference and strict validation rejects that deferred reference without executing it
