## REMOVED Requirements

### Requirement: Project-local guidance bootstrap
**Reason**: Installation location is not compatibility; the project-local mandate is replaced by selected installed CLI guidance.
**Migration**: Follow Installed guidance bootstrap and retain project-root configuration and plugin resolution.

## ADDED Requirements

### Requirement: Installed guidance bootstrap
The focused-spec loader SHALL obtain protocol-1 JSON workflow guidance from a selected installed CLI before each focused-spec workflow step. The selected CLI MAY be project-local, global, or explicitly located. Guidance SHALL belong to that executable's package, while configuration and plugins SHALL resolve from the consuming project root.

<!-- focused-spec:id=agent.guidance.project-local -->
#### Scenario: A selected installation supplies its own workflow
- **WHEN** an agent selects a compatible installed CLI outside the project, whether or not a different project-local CLI exists
- **THEN** it obtains that executable's package-owned guidance and does not substitute the project's installation
- **AND** The loader SHALL retain the same executable during the step, request applicable focused topics, and preserve host approval, lifecycle, and evidence boundaries. A local dependency MAY pin a version but SHALL NOT be mandatory. Ordinary guidance acquisition SHALL NOT download a package or use stale embedded procedure.

<!-- focused-spec:id=agent.guidance.unavailable -->
#### Scenario: An unavailable or legacy selected CLI stops focused-spec work
- **WHEN** the selected CLI is absent or predates the required guidance protocol or topic
- **THEN** the loader reports the missing compatible installation and does not continue using downloaded or embedded stale instructions

<!-- focused-spec:id=agent.guidance.invalid-response -->
#### Scenario: A successful but unusable response is not authority
- **WHEN** a guidance command exits successfully but its response has a mismatched protocol or topic, wrong package identity, malformed JSON, or empty content
- **THEN** focused-spec work stops with a diagnostic instead of applying the response as instructions

<!-- focused-spec:id=agent.guidance.session-refresh -->
#### Scenario: A subsequent step reloads an updated package
- **WHEN** the selected CLI is updated between two focused-spec workflow steps in the same agent session
- **THEN** the second step reloads the authoritative workflow from that installation rather than relying solely on retained instructions

## MODIFIED Requirements

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect unrelated product tests and installed package files, and report each gate independently.

<!-- focused-spec:id=agent.eval.failed-turn -->
#### Scenario: Failed agent turn stops downstream judges
- **WHEN** an evaluated agent turn exits unsuccessfully
- **THEN** the eval result records the failed turn and does not claim downstream behavior gates passed
- **AND** An unsuccessful agent turn SHALL prevent downstream success claims. A successful turn using the loader SHALL have loaded the focused-spec skill and successfully obtained valid authoritative workflow guidance from the selected installed CLI before its behavior is judged; reading only the loader, a failed command, or a command start without a usable response SHALL NOT certify activation. Guidance delivery SHALL NOT count as executable evidence. A coincidental passing result without skill and guidance activation SHALL NOT certify the skill workflow. Native evidence judgment SHALL recognize successfully completed selected tests executed through the installed focused-spec CLI as well as direct project test commands. It SHALL match the actual selected references in execution results, not count command starts, validation-only calls, failed commands, or unrelated targets as successful evidence execution. Saved model results SHALL remain immutable; a later gate correction MAY be checked against captured transcripts without claiming a new model run or rewriting the original score. The new loader activation contract SHALL apply to new runs and SHALL NOT retroactively relabel historical full-text-skill results.

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
- **WHEN** a successful evaluated turn reads the loader but does not complete a valid workflow-guidance request to the selected installed CLI
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
