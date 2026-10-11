# agent-workflow Specification

## Purpose

Proposal/apply boundaries and black-box evaluation of executable evidence.

## Requirements

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

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect unrelated product tests and installed package files, and report each gate independently. An unsuccessful agent turn SHALL prevent downstream success claims. A successful turn SHALL have loaded the focused-spec skill before its behavior is judged; a coincidental passing result without skill activation SHALL NOT certify the skill workflow.
Native evidence judgment SHALL recognize successfully completed selected tests executed through the installed focused-spec CLI as well as direct project test commands. It SHALL match the actual selected references in execution results, not count command starts, validation-only calls, failed commands, or unrelated targets as successful evidence execution. Saved model results SHALL remain immutable; a later gate correction MAY be checked against captured transcripts without claiming a new model run or rewriting the original score.

<!-- focused-spec:id=agent.eval.failed-turn -->
#### Scenario: Failed agent turn stops downstream judges
- **WHEN** an evaluated agent turn exits unsuccessfully
- **THEN** the eval result records the failed turn and does not claim downstream behavior gates passed

<!-- focused-spec:id=agent.eval.protected-files -->
#### Scenario: Protected files cannot be altered for a pass
- **WHEN** an agent changes a protected product test or installed package artifact
- **THEN** the integrity gate fails independently of other passing checks

<!-- focused-spec:id=agent.eval.skill-activation -->
#### Scenario: Successful turn must read the focused-spec skill
- **WHEN** a successful evaluated agent turn reads its host workflow skill but never reads the focused-spec skill
- **THEN** the skill-activation gate fails before judging downstream artifacts

<!-- focused-spec:id=agent.eval.native-cli-evidence -->
#### Scenario: Production CLI evidence execution is recognized
- **WHEN** an agent's completed focused-spec run reports the exact selected evidence passing
- **THEN** the execution gate recognizes it while rejecting validation, incomplete or failed commands, and different evidence

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL bind new or changed native outcomes without bulk-converting unrelated native scenarios. The native host SHALL own publication, movement, regeneration, archive and removal. Still-relevant enrolled occurrences SHALL retain explicit scope-local native bindings and executable registry evidence without owner/revision links or evidence inherited from a disappearing scope. After the host operation and required cleanup, the workflow SHALL validate the final selection and execute surviving evidence, distinguishing passing registered outcomes from unverified native history. It SHALL NOT require transition commands, plans, snapshots or replacement checkpoint artifacts. State-only production validation SHALL NOT claim historical loss detection when both a native item and its registration disappear consistently. Independent lifecycle evaluators MAY still compare actual evidence they execute before and after a host operation.

<!-- focused-spec:id=agent.adoption.preserve-native -->
#### Scenario: Untouched native outcomes remain untouched
- **WHEN** an agent enrolls one changed outcome in a project with native historical scenarios
- **THEN** unrelated native scenarios remain present and unreported as passed

<!-- focused-spec:id=agent.adoption.surviving-evidence -->
#### Scenario: Surviving evidence outlives a working document
- **WHEN** an outcome remains in a final selected scope and its working document leaves discovery
- **THEN** the surviving occurrence independently retains its ID and explicit evidence and executes without the working document or a production transition checkpoint

<!-- focused-spec:id=agent.adoption.evidence-continuity -->
#### Scenario: Independent evaluation rejects lost outcome evidence
- **WHEN** an independently observed host lifecycle drops or redirects evidence for an enrolled changed outcome
- **THEN** the evaluator rejects completion instead of accepting transient passing evidence as proof of the surviving outcome


### Requirement: Scoped evaluation judgment
Evaluation gates SHALL inspect the expected scenario within its configured selected scope and SHALL honor document discovery and exclusions. Same-ID occurrences in other scopes SHALL NOT be counted as duplicate selected items. Missing or duplicate expected occurrences within the selected scope SHALL fail the scenario contract.

<!-- focused-spec:id=agent.eval.scoped-identity -->
#### Scenario: Same identity in a different scope is not a duplicate
- **WHEN** valid same-ID occurrences exist in the selected scope and another configured scope
- **THEN** the scenario gate judges the selected occurrence and its evidence without counting the other occurrence as a competing owner


### Requirement: Isolated evaluation provisioning

Provisioning SHALL install independently owned package artifacts without rebuilding or modifying the shared repository distribution. Concurrent workspaces SHALL NOT delete or replace each other's package artifacts. Cleanup SHALL remove the workspace and its owned package artifacts.

<!-- focused-spec:id=agent.eval.provisioning-isolation -->
#### Scenario: Concurrent provisioning preserves the built distribution
- **WHEN** two eval workspaces are provisioned concurrently from a built product
- **THEN** both installed CLIs remain usable and the shared distribution is unchanged

### Requirement: Phase-correct lifecycle evaluation

Lifecycle evaluation SHALL independently execute working evidence before a host transition can remove its discovery, and SHALL independently execute the surviving occurrence after that transition. Final validation and controlled mutations SHALL use the surviving configured scope. Missing or failing pre-transition evidence SHALL stop the lifecycle before its next turn. Final evidence SHALL match the independently executed checkpoint and SHALL NOT be inferred from agent claims.

<!-- focused-spec:id=agent.eval.lifecycle-checkpoint -->
#### Scenario: Working evidence is verified before its discovery ends
- **WHEN** apply produces passing working evidence and sync retains the same main evidence while excluding the working document
- **THEN** working and surviving main evidence pass independently after working discovery ends, and altered evidence fails completion

<!-- focused-spec:id=agent.eval.lifecycle-stop -->
#### Scenario: Failed working evidence prevents publication judgment
- **WHEN** apply completes but its selected working evidence fails
- **THEN** the working checkpoint fails and the sync turn is not run

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
