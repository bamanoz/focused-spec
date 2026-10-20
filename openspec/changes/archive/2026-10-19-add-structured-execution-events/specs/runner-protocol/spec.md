# Runner protocol delta

## ADDED Requirements

### Requirement: Optional structured execution events
Runner API 1 target results SHALL optionally carry an ordered execution-event list alongside their existing status and diagnostic. Hosts SHALL validate and retain supported event records without interpreting observation names as business rules. Existing plugins that omit events SHALL remain usable with unchanged status and exact target-cardinality semantics.

<!-- focused-spec:id=runner.events.optional -->
#### Scenario: Event-capable and existing runners coexist
- **WHEN** one selected runner reports observations and explanations and another reports only its existing target status
- **THEN** both actual outcomes reach the caller, only the event-capable target has events, and no events are invented for the other target

### Requirement: Invalid event reports do not become evidence
An explicitly supplied event list SHALL satisfy the portable event schema, including valid kinds, required fields and JSON-compatible values. An invalid report SHALL yield the existing runner ERROR behavior rather than silently dropping malformed events or accepting a claimed pass. Evidence from unrelated runner invocations SHALL remain independent.

<!-- focused-spec:id=runner.events.invalid -->
#### Scenario: A malformed event prevents a claimed pass
- **WHEN** a runner reports pass with an unknown event kind or malformed observation payload
- **THEN** its invocation reports ERROR with an actionable diagnostic rather than returning that target as passing evidence

### Requirement: Event retention is explicitly bounded
Retained target events SHALL have documented count and encoded-byte bounds. When valid events exceed either bound, the report SHALL preserve an ordered prefix and include an explicit terminal truncation event within those bounds. Truncation SHALL NOT fabricate missing observations or alter a valid target's execution status.

<!-- focused-spec:id=runner.events.bounded -->
#### Scenario: A verbose target remains bounded without a hidden loss of detail
- **WHEN** a correctly executed target emits more events or larger values than its retention budget permits
- **THEN** its result retains a bounded ordered prefix and a visible truncation marker while preserving its actual status

### Requirement: Direct runners retain events on verification failure
Both direct scenario runners SHALL retain already collected events in their target report when SDK verification returns a mismatch or application error. Explanations and observations SHALL NOT determine pass status. An unexecuted action or missing final report SHALL NOT gain fabricated Actual events or a passing outcome.

<!-- focused-spec:id=runner.events.failed-target -->
#### Scenario: An explained wrong bank observation remains a failure
- **WHEN** a selected bank action explains its branch but returns an incorrect observation through either direct runner
- **THEN** the target fails and its report retains the available inputs, explanation and actual observation alongside the verification diagnostic
