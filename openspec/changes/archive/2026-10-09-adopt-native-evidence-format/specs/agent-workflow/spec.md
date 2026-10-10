## MODIFIED Requirements

### Requirement: Proposal and apply boundaries
The agent workflow SHALL keep an OpenSpec proposal planning-only and SHALL require concrete executable evidence before treating an applied change as complete.

<!-- focused-spec:id=agent.proposal.planning-only -->
#### Scenario: Proposal does not start implementation
- **WHEN** an agent proposal creates a runner or product implementation before the apply turn
- **THEN** the proposal checkpoint fails even if planning artifacts exist

<!-- focused-spec:id=agent.apply.mutation-sensitive -->
#### Scenario: Apply requires independent executable evidence
- **WHEN** a completed workspace's focused evidence remains green after a controlled product mutation
- **THEN** the completion judgment rejects the result rather than accepting a fake pass

### Requirement: New and changed evidence detects the claimed outcome
For each new or changed evidence reference, the agent workflow SHALL run the exact selected evidence, introduce a reversible regression in the claimed product behavior (not in the test, selector, runner, or assertion), require the selected test to execute and fail on its behavioral assertion, restore the behavior, and confirm the same evidence passes again. An unresolved target, runner error, skip, or unrelated test failure SHALL NOT count as a sensitivity check. When the regression cannot be introduced safely, the agent SHALL disclose the unverified sensitivity rather than claim it passed. This requirement does not cause the CLI to mutate product code automatically.

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
The agent workflow SHALL bind new or changed native outcomes without bulk-converting unrelated native scenarios. Before and after framework-owned edits, publication, replacement, or removal, it SHALL compare affected IDs, native-item bindings, outcome meaning, and registry evidence in surviving selected scopes. It SHALL retain explicit executable evidence for every still-relevant enrolled occurrence without owner or revision links and SHALL NOT inherit evidence from a disappearing scope. After the final selection is established it SHALL execute surviving evidence and distinguish passing registered outcomes from unverified native history. No particular SDD lifecycle command SHALL be required.

<!-- focused-spec:id=agent.adoption.preserve-native -->
#### Scenario: Untouched native outcomes remain untouched
- **WHEN** an agent enrolls one changed outcome in a project with native historical scenarios
- **THEN** unrelated native scenarios remain present and unreported as passed

<!-- focused-spec:id=agent.adoption.surviving-evidence -->
#### Scenario: Surviving evidence outlives a working document
- **WHEN** an outcome remains in a final selected scope and its working document leaves discovery
- **THEN** the surviving occurrence independently retains its ID and explicit evidence and executes without the working document

<!-- focused-spec:id=agent.adoption.evidence-continuity -->
#### Scenario: Final evidence continues to mean the same outcome
- **WHEN** a transition drops or redirects evidence for an enrolled changed outcome
- **THEN** the workflow rejects completion instead of accepting transient passing evidence


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
