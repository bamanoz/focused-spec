## ADDED Requirements

### Requirement: Runner responses survive transport without repair
Runner responses SHALL be JSON-compatible before transport. Nonfinite numbers, undefined values, functions, symbols, sparse arrays, cyclic values, accessors and non-JSON objects SHALL fail the invocation rather than being removed, coerced or replaced during serialization. Valid JSON payloads SHALL retain their exact values in resolve, partition and run responses. Receiver-side shape and cardinality validation SHALL remain enforced.

<!-- focused-spec:id=runner.response.lossless -->
#### Scenario: Invalid runner data cannot become passing evidence
- **WHEN** a selected runner returns values that JSON transport would silently remove or transform during resolution, partitioning or execution
- **THEN** its invocation fails without claiming PASS or executing rejected resolution or partition results, while a valid JSON response still executes with its original data
