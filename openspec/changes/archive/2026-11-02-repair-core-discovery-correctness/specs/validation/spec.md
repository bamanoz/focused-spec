# Spec Delta

## ADDED Requirements

### Requirement: Document-specific format parse failures remain isolated
A format plugin failure while parsing one document SHALL produce a diagnostic for that document without poisoning the format host or assigning the same failure to independent documents. Protocol violations, host exit, timeout, and oversized responses SHALL remain host-level failures.

<!-- focused-spec:id=validation.format.document-failure-isolation -->
#### Scenario: One document parse fails while other documents use the same format
- **WHEN** a format plugin throws for one document and successfully parses another document in the same discovery operation
- **THEN** only the failing document receives the parse diagnostic, while the other document is parsed and remains available for format binding
