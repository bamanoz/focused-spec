# execution-events Specification

## Purpose
Provide one optional execution-local event channel for reusable observations and real application explanations, independently of focused-spec integration, and expose that same information in both maintained bank examples.

## Requirements

### Requirement: One optional SDK execution channel
Both independent SDKs SHALL offer one optional observer for named observations/explanations with optional structured data, reporting Given, When, Expect and valid Actual. Without it, result/error/cleanup contracts SHALL remain unchanged, with no output or core dependency. Explanation validation SHALL be observer-independent: disabled capture SHALL NOT accept invalid arguments or deliver events or allocate solely for observation.

<!-- focused-spec:id=execution-events.sdk-capture -->
#### Scenario: A standalone caller observes an actual verification
- **WHEN** an SDK-only consumer observes a scenario that emits an application explanation and returns an incorrect observation
- **THEN** it receives the declared inputs, expectation, explanation and actual observation through one ordered channel while exact verification still fails

<!-- focused-spec:id=execution-events.explain-validation-independent -->
#### Scenario: Observer configuration does not change explanation validity
- **WHEN** the same driver emits a malformed explanation with and without an observer
- **THEN** both executions reject the invalid explanation, and only the observed execution attempts event delivery

### Requirement: Observation snapshots are isolated
Observed data SHALL reflect emission-time values, unaffected by driver mutation or cleanup. Observer mutation SHALL NOT rewrite declarations, other events or verification expectations. Concurrent runs with distinct observers SHALL NOT mix events. Successful verification results and mismatch Actual detail SHALL be independent snapshots captured after Actual validation and before cleanup, and SHALL remain unchanged by cleanup mutation.

<!-- focused-spec:id=execution-events.snapshots -->
#### Scenario: Mutation cannot rewrite the observed verification
- **WHEN** a driver and an observer mutate nested values and cleanup mutates the returned application state
- **THEN** driver and cleanup changes do not alter earlier captured snapshots, and changing an observer-owned payload does not change the reusable declaration, another event or the original Expect used for verification

<!-- focused-spec:id=execution-events.actual-result-snapshot -->
#### Scenario: Cleanup mutation cannot rewrite SDK actual result
- **WHEN** a TypeScript or Python driver returns a valid observation and cleanup mutates the returned application state
- **THEN** the successful return and any mismatch Actual detail retain the values captured before cleanup

### Requirement: Portable observations preserve language semantics
Transported observations SHALL contain either a JSON-compatible value or an explicitly textual representation. A language value not faithfully representable in the portable JSON value model SHALL be reported as text rather than silently coerced or rejected as scenario data. Representation SHALL NOT change typed equality, invoke custom serialization hooks or weaken the SDK's accepted data contract.

<!-- focused-spec:id=execution-events.portable-go -->
#### Scenario: A Go value outside portable JSON remains verifiable
- **WHEN** a valid Go scenario observes a large integer or complex value with event collection enabled
- **THEN** exact typed verification retains its ordinary outcome and its event carries an explicit readable representation without numeric loss or a failed JSON transport

### Requirement: Bank demonstrations use the execution channel end to end
Both maintained bank consumers SHALL display Given, When, Expect, Actual and real withdrawal-branch explanations from the common execution channel in standalone demos and focused execution. The existing six canonical scenarios and their IDs SHALL remain the only business scenario source; demos SHALL NOT reconstruct Actual or explanations from expectations.

<!-- focused-spec:id=execution-events.bank-end-to-end -->
#### Scenario: The bank explains the same real decision across execution surfaces
- **WHEN** either bank's insufficient-funds scenario runs through its standalone demo, detailed focused output and JSON output
- **THEN** each surface shows the actual declared inputs, expectation, returned decline event and application explanation with requested and available amounts from that execution
