# Spec Delta

## MODIFIED Requirements

### Requirement: Proposal and apply boundaries
The agent workflow SHALL keep an OpenSpec proposal planning-only and SHALL require concrete executable evidence before treating an applied change as complete.

<!-- focused-spec:id=agent.proposal.planning-only -->
#### Scenario: Proposal does not start implementation
- **WHEN** an agent proposal creates a runner, product implementation, configuration, or executable evidence registry before the apply turn
- **THEN** the proposal checkpoint fails even if planning artifacts exist and registry references are planned
- **AND** A planning-only turn SHALL record intended exact evidence in planning artifacts and SHALL NOT create or modify executable evidence registries, configuration, runners, or product implementation, including setup containing planned references. Existing permitted native-format checks MAY run without creating integration setup.

<!-- focused-spec:id=agent.apply.mutation-sensitive -->
#### Scenario: Apply requires independent executable evidence
- **WHEN** a completed workspace's focused evidence remains green after a controlled product mutation
- **THEN** the completion judgment rejects the result rather than accepting a fake pass

<!-- focused-spec:id=agent.proposal.product-checkpoint -->
#### Scenario: Proposal integrity is checked before apply
- **WHEN** a proposal modifies product code or tests and the apply turn would restore them
- **THEN** the proposal checkpoint rejects the violation before apply executes

### Requirement: New and changed evidence detects the claimed outcome
The agent workflow SHALL prove behavioral sensitivity for each new or changed evidence reference, selected assertion, or claimed product outcome.

<!-- focused-spec:id=agent.evidence.vacuous-repair -->
#### Scenario: Falsely green evidence is rejected
- **WHEN** an existing selected test checks only the type of an authentication result and remains green after blocked-account protection is removed
- **THEN** the agent evaluation rejects that evidence until the selected test fails on the blocked-account assertion and passes again after restoration; it also rejects an agent turn that omits the sensitivity probe
- **AND** For each new or changed evidence reference, and for each changed selected assertion or claimed product behavior even when its reference stays unchanged, the agent workflow SHALL run the exact selected evidence, introduce a reversible regression in the claimed product behavior (not in the test, selector, runner, or assertion), require the selected test to execute and fail on its behavioral assertion, restore the behavior, and confirm the same evidence passes again. An unresolved target, runner error, skip, or unrelated test failure SHALL NOT count as a sensitivity check. When the regression cannot be introduced safely, the agent SHALL disclose the unverified sensitivity rather than claim it passed. This requirement does not cause the CLI to mutate product code automatically.

<!-- focused-spec:id=agent.evidence.exact-mutation -->
#### Scenario: Only selected behavioral failure proves sensitivity
- **WHEN** a mutation run reports selected ERROR, unrelated FAIL or failing restoration
- **THEN** sensitivity fails; only the selected behavioral FAIL followed by restored exact PASS is accepted

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect unrelated product tests and installed package files, and report each gate independently.

<!-- focused-spec:id=agent.eval.failed-turn -->
#### Scenario: Failed agent turn stops downstream judges
- **WHEN** an evaluated agent turn exits unsuccessfully
- **THEN** the eval result records the failed turn and does not claim downstream behavior gates passed
- **AND** An unsuccessful agent turn SHALL prevent downstream success claims. A successful turn using the loader SHALL have loaded the focused-spec skill and successfully obtained valid authoritative workflow guidance from the installed project-local CLI before its behavior is judged; reading only the loader, a failed command, or a command start without a usable response SHALL NOT certify activation. Guidance delivery SHALL NOT count as executable evidence. A coincidental passing result without skill and guidance activation SHALL NOT certify the skill workflow. Native evidence judgment SHALL recognize successfully completed selected tests executed through the installed focused-spec CLI as well as direct project test commands. It SHALL match the actual selected references in execution results, not count command starts, validation-only calls, failed commands, or unrelated targets as successful evidence execution. Saved model results SHALL remain immutable; a later gate correction MAY be checked against captured transcripts without claiming a new model run or rewriting the original score. The new loader activation contract SHALL apply to new runs and SHALL NOT retroactively relabel historical full-text-skill results.

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

<!-- focused-spec:id=agent.eval.guidance-activation -->
#### Scenario: Reading the loader alone does not activate the workflow
- **WHEN** a successful evaluated turn reads the loader but does not complete a valid workflow-guidance request to the project-local CLI
- **THEN** the guidance-activation gate rejects the turn even if unrelated tests pass

<!-- focused-spec:id=agent.eval.direct-exact -->
#### Scenario: Direct execution proves the selected test ran
- **WHEN** a direct framework command matches zero tests or passes a same-named test in a different file or package
- **THEN** the execution gate rejects it while exact observed selected execution remains accepted

<!-- focused-spec:id=agent.eval.timeout-persist -->
#### Scenario: Interrupted turns retain results and stop owned processes
- **WHEN** an evaluated driver times out or throws after starting descendants and producing output
- **THEN** owned processes terminate and an immutable failed result retains available transcript without downstream success claims

<!-- focused-spec:id=agent.eval.inspection-directories -->
#### Scenario: Implementation directory inspection is not black-box
- **WHEN** a public or native agent reads or searches installed implementation directories
- **THEN** integrity fails while public README, type declarations and real CLI execution remain permitted

<!-- focused-spec:id=agent.eval.immutable-collision -->
#### Scenario: Result saves never overwrite a prior run
- **WHEN** two results are persisted with the same case and clock timestamp
- **THEN** both receive distinct paths and the prior artifact stays byte-for-byte unchanged

<!-- focused-spec:id=agent.eval.diagnostic-last-phase -->
#### Scenario: Diagnostic resumes the phase that failed
- **WHEN** BMad regeneration fails after successful native authoring
- **THEN** the diagnostic uses the regeneration session and request without changing scores

### Requirement: Configured working-scope judgment
When a task names an OpenSpec change but does not prescribe a focused scope label, evaluation SHALL select the one configured scope containing that change's native documents rather than assume the scope equals the change name.

<!-- focused-spec:id=agent.eval.configured-working-scope -->
#### Scenario: Named change uses an explicit configured scope
- **WHEN** an agent configures the named change's native documents under a single explicit scope different from the change name and binds the selected identity there
- **THEN** completion executes that configured scope and its exact evidence, while ambiguous scopes, a different change's item, and a changed selected identity remain rejected
- **AND** A missing or ambiguous scope, an item outside the named change, or a frozen identity mismatch SHALL fail. Selected evidence SHALL retain its real runner selector contract; equivalent exact Go selectors SHALL NOT be rejected solely for using a file path instead of a package path.

<!-- focused-spec:id=agent.eval.working-checkpoint-scope -->
#### Scenario: Working checkpoint resolves configured scope
- **WHEN** a named change is assigned one explicit scope different from its change name
- **THEN** the pre-transition checkpoint freezes and executes that scope; missing or ambiguous scope fails

### Requirement: Genuine planning and user confirmation
An Agent OS authoring fixture SHALL enter the runtime's actual read-only plan mode before shaping, serve host user-question requests through a separate tool-free and skill-free test-user receiving only the task and conversation, and require explicit plan approval before execution.

<!-- focused-spec:id=agent.eval.plan-confirmation -->
#### Scenario: Approval controls transition from real planning to authoring
- **WHEN** the runtime presents a completed plan for approval while Agent OS shaping is in actual read-only plan mode
- **THEN** cancellation or refinement keeps authoring blocked, and only an explicit in-scope test-user approval permits execution while retaining the recorded mode transition and decision
- **AND** A mode declaration in prose or automatic approval SHALL NOT supply these prerequisites. The evaluation SHALL retain the actual mode transitions and user decisions, reject native or registry writes before approval, and report unsupported transport capabilities as unverified rather than passed.

<!-- focused-spec:id=agent.eval.consent-path-boundaries -->
#### Scenario: Approval paths do not authorize lookalikes
- **WHEN** an approved path is only a substring of another proposed or submitted path
- **THEN** the lookalike does not authorize the shorter path while exact paths and explicit authorized directory rules remain accepted
