## ADDED Requirements

### Requirement: Human output renders opaque values safely
Human execution, validation, inspection and command-error output SHALL escape terminal control, format and Unicode line-separator characters in supplied values, including identities, references, provenance and diagnostics. Diagnostic line breaks MAY be retained with host-controlled indentation. Escaping SHALL be presentation-only: selectors received by runners and values represented in JSON SHALL remain unchanged.

<!-- focused-spec:id=execution.presentation.safe-text -->
#### Scenario: Opaque values cannot control terminal presentation
- **WHEN** native identities, names, paths, evidence selectors or runner diagnostics contain terminal controls or formatting characters
- **THEN** human output shows escaped text without emitting those controls, and JSON plus runner execution preserve the exact original values and actual outcomes
