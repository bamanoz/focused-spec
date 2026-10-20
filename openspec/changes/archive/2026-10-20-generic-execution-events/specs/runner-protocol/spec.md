# Runner protocol delta

## MODIFIED Requirements

### Requirement: Optional structured execution events
Runner API 1 target results SHALL optionally carry ordered events with nonblank string kind and message and optional JSON-compatible data. Kind SHALL be producer-defined: core SHALL NOT restrict kinds or interpret their meaning. Existing plugins omitting events SHALL retain unchanged status and cardinality semantics.

<!-- focused-spec:id=runner.events.optional -->
#### Scenario: Event-capable and existing runners coexist
- **WHEN** one selected runner reports its own event kinds, including a record named truncated followed by another event, and another reports only its existing target status
- **THEN** both actual outcomes reach the caller, all supplied generic events remain ordered, and no events are invented for the other target

### Requirement: Invalid event reports do not become evidence
An explicitly supplied event list SHALL satisfy the generic event envelope, including nonblank kind and message, optional JSON-compatible data and no unknown envelope fields. Every supplied record SHALL be validated, including any omitted suffix. Invalid reports SHALL yield runner ERROR, not a claimed pass; unrelated invocations SHALL remain independent.

<!-- focused-spec:id=runner.events.invalid -->
#### Scenario: A malformed event prevents a claimed pass
- **WHEN** a runner reports pass with missing or invalid envelope fields or non-JSON data, even after the retained prefix
- **THEN** its invocation reports ERROR with an actionable diagnostic rather than returning that target as passing evidence

### Requirement: Event retention is explicitly bounded
Retained target events SHALL have documented count and encoded-byte bounds. Overflow SHALL preserve an ordered prefix and append an explicit truncation notice within those bounds without altering the target's status. A producer-defined kind SHALL NOT stop collection or make subsequent valid events invalid.

<!-- focused-spec:id=runner.events.bounded -->
#### Scenario: A verbose target remains bounded without a hidden loss of detail
- **WHEN** a correctly executed target emits more events or larger values than its retention budget permits
- **THEN** its result retains a bounded ordered prefix and a visible truncation marker while preserving its actual status
