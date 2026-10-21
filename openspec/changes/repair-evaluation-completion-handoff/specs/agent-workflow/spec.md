# Spec Delta

## ADDED Requirements

### Requirement: Configured native revisions complete missing enrollment
An authorized revision to a native item selected by existing executable-evidence configuration SHALL complete missing enrollment before reporting completion. Missing enrollment SHALL NOT imply prose-only scope. Agents SHALL obtain host-required authorization for remaining integration, preserve read-only/planning limits, and leave unrelated native items unenrolled.

<!-- focused-spec:id=agent.review.missing-enrollment -->
#### Scenario: A configured requirement has no evidence binding yet
- **WHEN** a user authorizes a revision to an already-implemented native requirement selected by existing configuration but its evidence source or binding is absent
- **THEN** the agent completes authorized enrollment and exact verification, or requests the host-required authorization for the concrete remaining integration instead of finishing with prose and direct-test success alone
- **AND** missing enrollment remains a failed integration prerequisite, not proof that no direct test ran or permission to enroll unrelated items

### Requirement: Research and interaction failures retain diagnostic evidence
Evaluation results SHALL retain completed failure-interview replies in order and the available output of unsuccessful or undecodable user responders. Diagnostic collection SHALL NOT grant consent, retry a scored turn, change its verdict, or rewrite historical results.

<!-- focused-spec:id=agent.eval.research-replies -->
#### Scenario: A continuation follows substantive research recommendations
- **WHEN** an interview produces recommendations and then a completed runtime continuation about unfinished scored-task work
- **THEN** the diagnostic answer retains the recommendations and continuation in order without changing scored turns or gates

<!-- focused-spec:id=agent.eval.responder-failure -->
#### Scenario: A host question receives no usable responder decision
- **WHEN** a responder exits unsuccessfully, throws a transport error, or produces an undecodable answer
- **THEN** the planning result retains the unanswered question and available responder output with no decoded decision, and does not authorize execution
