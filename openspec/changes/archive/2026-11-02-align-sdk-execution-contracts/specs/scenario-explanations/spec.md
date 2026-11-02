# Spec Delta

## MODIFIED Requirements

### Requirement: Explanation capture is execution local
Executions SHALL use independent sinks, no shared mutable collector, ordered sequential emissions and isolated concurrent messages. Every SDK SHALL validate explanations regardless of observers: blank/invalid messages or unsupported data SHALL fail by its error convention. Without observers, valid explanations SHALL be silent, without event-snapshot allocation/retention solely for delivery. Observers SHALL NOT change acceptance.

<!-- focused-spec:id=scenario-explanations.isolation -->
#### Scenario: Concurrent runs retain separate decision explanations
- **WHEN** two scenario executions with separate sinks interleave their application decisions
- **THEN** each sink receives only its own execution's explanations in emission order

<!-- focused-spec:id=scenario-explanations.validation-independent -->
#### Scenario: Explanation validity is independent of observer
- **WHEN** an application emits the same valid or invalid explanation with and without an observer
- **THEN** argument validation has the same outcome in both executions, while only the observed execution delivers valid event data
