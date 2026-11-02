# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit validated scenario data
Scenarios SHALL have exact nonblank control-free IDs, nonblank names and explicit Given/When/Expect. Suites SHALL reject duplicate IDs and unsupported data before preparation, without dropping/converting it. Go SHALL validate explanations with or without sinks; invalid messages/data SHALL use its panic contract. Without sinks, valid explanations SHALL be unobserved, without event-snapshot allocation/retention solely for delivery.

<!-- focused-spec:id=go-sdk.invalid-declaration -->
#### Scenario: Invalid declarations cannot execute application code
- **WHEN** a suite duplicates an ID or a scenario contains an invalid identity or unsupported data
- **THEN** validation rejects it and application preparation does not run

<!-- focused-spec:id=go-sdk.explain-validation-independent -->
#### Scenario: Invalid explanation fails without an event sink
- **WHEN** application code calls Explain with a blank message or unsupported data and its context has no event sink
- **THEN** the SDK rejects the invalid explanation rather than returning silently
