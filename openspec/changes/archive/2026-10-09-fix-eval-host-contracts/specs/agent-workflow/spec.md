## ADDED Requirements

### Requirement: Task-grounded evaluation identities

Black-box evaluation SHALL require an exact focused ID only when the task or pre-existing source prescribes it. For new authoring without a prescribed ID, the evaluator SHALL accept exactly one valid newly authored native identity in the selected scope, retain that identity at the first successful checkpoint, and require subsequent apply and publication judgments to use the same identity. Missing, duplicate, invalid, or changed identities SHALL fail; selected evidence, behavior sensitivity, integrity, and planning boundaries SHALL remain independently judged.

<!-- focused-spec:id=agent.eval.authored-identity -->
#### Scenario: Unspecified authored identity is retained through apply
- **WHEN** a blind proposal task prescribes no ID and the agent creates one valid native marker with a different valid name from historical examples
- **THEN** the proposal checkpoint accepts the authored name and subsequent judgment rejects a renamed or ambiguous binding instead of requiring an undisclosed fixed ID

<!-- focused-spec:id=agent.eval.prescribed-identity -->
#### Scenario: Existing identity cannot be replaced
- **WHEN** the task or starting source prescribes a focused ID and the agent replaces it with another valid ID
- **THEN** the evaluation rejects the replacement even when its evidence executes successfully

### Requirement: Discoverable genuine host authoring guidance

Native authoring fixtures SHALL expose applicable official host authoring guidance through the evaluated runtime's discovery mechanism, with source provenance and unchanged official workflow content. Installation or orchestration instructions alone SHALL NOT count as specification-authoring guidance. Host integration guidance MAY identify host-owned generated artifacts and stable native-ID conventions without disclosing task-specific focused IDs or evidence selectors. Generated-source, approval, protected-file, and host-validation gates SHALL remain intact.

<!-- focused-spec:id=agent.eval.host-guidance -->
#### Scenario: Installed authoring guidance is discoverable and actually read
- **WHEN** Spec Kit authoring guidance is installed for the evaluated runtime
- **THEN** the applicable authoring skill is discoverable and a successful read counts as guidance activation while installation-only, failed, incomplete, and lookalike reads do not

<!-- focused-spec:id=agent.eval.host-dialogue -->
#### Scenario: In-scope metadata review receives a real user reply
- **WHEN** a native authoring agent proposes a concrete evidence-metadata revision and stops for user confirmation
- **THEN** the bounded fixture conversation supplies an independent in-scope user reply without approving other paths or treating an unanswered question as completed authoring

### Requirement: Genuine planning and user confirmation

An Agent OS authoring fixture SHALL enter the runtime's actual read-only plan mode before shaping, serve host user-question requests through a separate tool-free and skill-free test-user receiving only the task and conversation, and require explicit plan approval before execution. A mode declaration in prose or automatic approval SHALL NOT supply these prerequisites. The evaluation SHALL retain the actual mode transitions and user decisions, reject native or registry writes before approval, and report unsupported transport capabilities as unverified rather than passed.

<!-- focused-spec:id=agent.eval.plan-confirmation -->
#### Scenario: Approval controls transition from real planning to authoring
- **WHEN** the runtime presents a completed plan for approval while Agent OS shaping is in actual read-only plan mode
- **THEN** cancellation or refinement keeps authoring blocked, and only an explicit in-scope test-user approval permits execution while retaining the recorded mode transition and decision

### Requirement: Equivalent native rejection outcomes

Native outcome judgment SHALL recognize equivalent rejection wording, including denial, without requiring a hidden exact phrase. It SHALL still require the blocked-account condition, valid credentials, the rejection outcome in the same atomic native capability, exactly one applicable identity binding, and generated-source ownership constraints.

<!-- focused-spec:id=agent.eval.native-denial -->
#### Scenario: Generated denial wording retains one atomic outcome
- **WHEN** a generated BMad capability states that authentication returns denial for a blocked account with valid credentials
- **THEN** native authoring judgment accepts the uniquely bound unmarked capability and rejects omission of the valid-credentials condition, omission of rejection, duplicate native identity, or a generated-source marker

### Requirement: Configured working-scope judgment

When a task names an OpenSpec change but does not prescribe a focused scope label, evaluation SHALL select the one configured scope containing that change's native documents rather than assume the scope equals the change name. A missing or ambiguous scope, an item outside the named change, or a frozen identity mismatch SHALL fail. Selected evidence SHALL retain its real runner selector contract; equivalent exact Go selectors SHALL NOT be rejected solely for using a file path instead of a package path.

<!-- focused-spec:id=agent.eval.configured-working-scope -->
#### Scenario: Named change uses an explicit configured scope
- **WHEN** an agent configures the named change's native documents under a single explicit scope different from the change name and binds the selected identity there
- **THEN** completion executes that configured scope and its exact evidence, while ambiguous scopes, a different change's item, and a changed selected identity remain rejected

## MODIFIED Requirements

### Requirement: Proposal and apply boundaries
The agent workflow SHALL keep an OpenSpec proposal planning-only and SHALL require concrete executable evidence before treating an applied change as complete. A planning-only turn SHALL record intended exact evidence in planning artifacts and SHALL NOT create or modify executable evidence registries, configuration, runners, or product implementation, including setup containing planned references. Existing permitted native-format checks MAY run without creating integration setup.

<!-- focused-spec:id=agent.proposal.planning-only -->
#### Scenario: Proposal does not start implementation
- **WHEN** an agent proposal creates a runner, product implementation, configuration, or executable evidence registry before the apply turn
- **THEN** the proposal checkpoint fails even if planning artifacts exist and registry references are planned

<!-- focused-spec:id=agent.apply.mutation-sensitive -->
#### Scenario: Apply requires independent executable evidence
- **WHEN** a completed workspace's focused evidence remains green after a controlled product mutation
- **THEN** the completion judgment rejects the result rather than accepting a fake pass

### Requirement: New and changed evidence detects the claimed outcome
For each new or changed evidence reference, and for each changed selected assertion or claimed product behavior even when its reference stays unchanged, the agent workflow SHALL run the exact selected evidence, introduce a reversible regression in the claimed product behavior (not in the test, selector, runner, or assertion), require the selected test to execute and fail on its behavioral assertion, restore the behavior, and confirm the same evidence passes again. An unresolved target, runner error, skip, or unrelated test failure SHALL NOT count as a sensitivity check. When the regression cannot be introduced safely, the agent SHALL disclose the unverified sensitivity rather than claim it passed. This requirement does not cause the CLI to mutate product code automatically.

<!-- focused-spec:id=agent.evidence.vacuous-repair -->
#### Scenario: Falsely green evidence is rejected
- **WHEN** an existing selected test checks only the type of an authentication result and remains green after blocked-account protection is removed
- **THEN** the agent evaluation rejects that evidence until the selected test fails on the blocked-account assertion and passes again after restoration; it also rejects an agent turn that omits the sensitivity probe
