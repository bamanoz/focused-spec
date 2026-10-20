# Scenario explanations

## Purpose

Let standalone scenario consumers observe why the application made a decision during the actual execution without adding behavioral text to another scenario source or weakening exact expectations.

## ADDED Requirements

### Requirement: Observe actual application decisions
Both language SDKs SHALL let a caller opt into text explanations emitted during actual driver execution. Both bank demos SHALL display explanations originating in the application's withdrawal decision alongside the existing scenario inputs and observations. The driver SHALL NOT infer explanations by reimplementing the bank's decision rules.

<!-- focused-spec:id=scenario-explanations.application-decision -->
#### Scenario: A declined withdrawal explains the branch taken
- **WHEN** a standalone bank demo executes the insufficient-funds scenario with explanation capture enabled
- **THEN** it displays the application's actual insufficient-funds decision with requested and available amounts alongside the verified result

### Requirement: Explanation capture is execution local
Independent executions SHALL use independently supplied explanation sinks without a shared mutable collector. Sequential emissions within one execution SHALL reach its sink in emission order. Concurrent runs using distinct sinks SHALL NOT receive each other's messages.

<!-- focused-spec:id=scenario-explanations.isolation -->
#### Scenario: Concurrent runs retain separate decision explanations
- **WHEN** two scenario executions with separate sinks interleave their application decisions
- **THEN** each sink receives only its own execution's explanations in emission order

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
