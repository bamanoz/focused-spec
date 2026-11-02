# scenario-explanations Specification

## Purpose
Let standalone scenario consumers observe why the application made a decision during the actual execution without adding behavioral text to another scenario source or weakening exact expectations.

## Requirements

### Requirement: Observe actual application decisions
Both language SDKs SHALL let a caller opt into text explanations emitted during actual driver execution. Both bank demos SHALL display explanations originating in the application's withdrawal decision alongside the existing scenario inputs and observations. The driver SHALL NOT infer explanations by reimplementing the bank's decision rules.

<!-- focused-spec:id=scenario-explanations.application-decision -->
#### Scenario: A declined withdrawal explains the branch taken
- **WHEN** a standalone bank demo executes the insufficient-funds scenario with explanation capture enabled
- **THEN** it displays the application's actual insufficient-funds decision with requested and available amounts alongside the verified result

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

### Requirement: Explanations do not replace verification
Enabling explanations SHALL retain exact expectation comparison and existing cleanup and failure semantics. Explanations already delivered before a mismatch or application error SHALL remain observable to the caller; emitting a convincing explanation SHALL NOT make an incorrect observation pass.

<!-- focused-spec:id=scenario-explanations.failure -->
#### Scenario: An explained incorrect decision still fails
- **WHEN** an application emits an explanation and an observation different from Expect after successful preparation
- **THEN** verification fails, cleanup runs, and the caller can still inspect the emitted explanation and original failure

### Requirement: Explanation collection is optional
Existing callers SHALL retain their current result and error contracts without configuring an explanation sink. Application explanation calls without a configured sink SHALL NOT require global logging, CLI integration or a test framework, and SHALL NOT emit SDK-owned console output.

<!-- focused-spec:id=scenario-explanations.optional -->
#### Scenario: Standalone execution works without a sink
- **WHEN** an independently installed SDK executes a driver that emits an explanation without a configured sink
- **THEN** the caller receives the ordinary verified actual result without installing focused-spec or receiving unsolicited explanation output
