## ADDED Requirements

### Requirement: Project-local guidance bootstrap
The focused-spec loader SHALL obtain protocol-1 JSON workflow guidance from the consuming project's installed CLI before each focused-spec workflow step.


<!-- focused-spec:id=agent.guidance.project-local -->
#### Scenario: A global installation does not override the project's workflow
- **WHEN** an agent loads focused-spec in a project with a local CLI and a different global CLI earlier on PATH
- **THEN** it obtains guidance and executes focused-spec commands from the local installation
- **AND** It SHALL identify the project or declared workspace installation root from project context and invoke that installation explicitly, rather than choosing an unverified global binary on PATH or downloading `latest`. The loader SHALL use that same installation for subsequent focused-spec commands in the step and obtain the `runners` topic when runner work is needed. It SHALL verify successful command completion, matching protocol, package identity, requested topic, and nonempty content before treating the returned workflow as authoritative. Loading guidance SHALL NOT authorize writes forbidden by the host's current phase or replace its approval, validation, lifecycle, or evidence requirements.

<!-- focused-spec:id=agent.guidance.unavailable -->
#### Scenario: An absent or legacy local CLI stops focused-spec work
- **WHEN** the project's CLI is absent or predates the `instructions` command
- **THEN** the loader reports the missing compatible installation and does not continue using global, downloaded, or embedded stale focused-spec instructions

<!-- focused-spec:id=agent.guidance.invalid-response -->
#### Scenario: A successful but unusable response is not authority
- **WHEN** a guidance command exits successfully but its response has a mismatched protocol or topic, wrong package identity, malformed JSON, or empty content
- **THEN** the loader stops focused-spec work with a diagnostic instead of applying the response as instructions

<!-- focused-spec:id=agent.guidance.session-refresh -->
#### Scenario: A subsequent step reloads an updated local package
- **WHEN** the local CLI is updated between two focused-spec workflow steps in the same agent session
- **THEN** the second step reloads the authoritative workflow from that installation rather than relying solely on instructions retained from the first step

## MODIFIED Requirements

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect unrelated product tests and installed package files, and report each gate independently. An unsuccessful agent turn SHALL prevent downstream success claims. A successful turn using the loader SHALL have loaded the focused-spec skill and successfully obtained valid authoritative workflow guidance from the installed project-local CLI before its behavior is judged; reading only the loader, a failed command, or a command start without a usable response SHALL NOT certify activation. Guidance delivery SHALL NOT count as executable evidence. A coincidental passing result without skill and guidance activation SHALL NOT certify the skill workflow.
Native evidence judgment SHALL recognize successfully completed selected tests executed through the installed focused-spec CLI as well as direct project test commands. It SHALL match the actual selected references in execution results, not count command starts, validation-only calls, failed commands, or unrelated targets as successful evidence execution. Saved model results SHALL remain immutable; a later gate correction MAY be checked against captured transcripts without claiming a new model run or rewriting the original score. The new loader activation contract SHALL apply to new runs and SHALL NOT retroactively relabel historical full-text-skill results.

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

<!-- focused-spec:id=agent.eval.guidance-activation -->
#### Scenario: Reading the loader alone does not activate the workflow
- **WHEN** a successful evaluated turn reads the loader but does not complete a valid workflow-guidance request to the project-local CLI
- **THEN** the guidance-activation gate rejects the turn even if unrelated tests pass
