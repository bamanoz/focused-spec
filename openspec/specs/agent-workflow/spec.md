# agent-workflow Specification

## Purpose

Proposal/apply boundaries and black-box evaluation of executable evidence.

## Requirements

### Requirement: Proposal and apply boundaries
The agent workflow SHALL keep an OpenSpec proposal planning-only and SHALL require concrete executable evidence before treating an applied change as complete.

<!-- focused-spec:id=agent.proposal.planning-only -->
#### Scenario: Proposal does not start implementation
- **WHEN** an agent proposal creates a runner, product implementation, configuration, executable evidence registry or inline executable evidence integration before the apply turn
- **THEN** the proposal checkpoint fails even if planning artifacts exist and registry references are planned
- **AND** A planning-only turn SHALL record intended exact evidence in planning artifacts and SHALL NOT create or modify executable evidence registries, inline evidence integration, configuration, runners, or product implementation, including setup containing planned references. Existing permitted native-format checks MAY run without creating integration setup.

<!-- focused-spec:id=agent.apply.mutation-sensitive -->
#### Scenario: Apply requires independent executable evidence
- **WHEN** a completed workspace's focused evidence remains green after a controlled product mutation
- **THEN** the completion judgment rejects the result rather than accepting a fake pass

<!-- focused-spec:id=agent.proposal.product-checkpoint -->
#### Scenario: Proposal integrity is checked before apply
- **WHEN** a proposal modifies product code or tests and the apply turn would restore them
- **THEN** the proposal checkpoint rejects the violation before apply executes

<!-- focused-spec:id=agent.proposal.inline-boundary -->
#### Scenario: Planning inline evidence does not authorize integration
- **WHEN** an agent writes executable inline EVIDENCE during a planning-only proposal rather than recording intended references in design/tasks
- **THEN** the independent proposal checkpoint rejects integration before apply without confusing fenced authoring examples with executable enrollment

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

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL bind new or changed native outcomes without bulk-converting unrelated native scenarios.

<!-- focused-spec:id=agent.adoption.preserve-native -->
#### Scenario: Untouched native outcomes remain untouched
- **WHEN** an agent enrolls one changed outcome in a project with native historical scenarios
- **THEN** unrelated native scenarios remain present and unreported as passed
- **AND** The native host SHALL own publication, movement, regeneration, archive and removal. Still-relevant enrolled occurrences SHALL retain explicit scope-local native bindings and exact format-owned evidence without owner/revision links or evidence inherited from a disappearing scope. After the host operation and required cleanup, the workflow SHALL validate the final selection and execute surviving evidence, distinguishing passing registered outcomes from unverified native history. It SHALL NOT require transition commands, plans, snapshots or replacement checkpoint artifacts. State-only production validation SHALL NOT claim historical loss detection when both a native item and its registration disappear consistently. Independent lifecycle evaluators MAY still compare actual evidence they execute before and after a host operation.

<!-- focused-spec:id=agent.adoption.surviving-evidence -->
#### Scenario: Surviving evidence outlives a working document
- **WHEN** an outcome remains in a final selected scope and its working document leaves discovery
- **THEN** the surviving occurrence independently retains its ID and explicit evidence and executes without the working document or a production transition checkpoint

<!-- focused-spec:id=agent.adoption.evidence-continuity -->
#### Scenario: Independent evaluation rejects lost outcome evidence
- **WHEN** an independently observed host lifecycle drops or redirects evidence for an enrolled changed outcome
- **THEN** the evaluator rejects completion instead of accepting transient passing evidence as proof of the surviving outcome

<!-- focused-spec:id=agent.adoption.inline-continuity -->
#### Scenario: Inline evidence survives native lifecycle operations
- **WHEN** an explicitly inline-authored outcome is revised and published while its working document leaves discovery
- **THEN** the surviving occurrence retains its opaque identity and every exact AND reference in the chosen inline representation, independently executes and remains mutation-sensitive without a forced YAML conversion

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
Lifecycle evaluation SHALL independently execute working evidence before a host transition can remove its discovery, and SHALL independently execute the surviving occurrence after that transition.

<!-- focused-spec:id=agent.eval.lifecycle-checkpoint -->
#### Scenario: Working evidence is verified before its discovery ends
- **WHEN** apply produces passing working evidence and sync retains the same main evidence while excluding the working document
- **THEN** working and surviving main evidence pass independently after working discovery ends, and altered evidence fails completion
- **AND** Final validation and controlled mutations SHALL use the surviving configured scope. Missing or failing pre-transition evidence SHALL stop the lifecycle before its next turn. Final evidence SHALL match the independently executed checkpoint and SHALL NOT be inferred from agent claims.

<!-- focused-spec:id=agent.eval.lifecycle-stop -->
#### Scenario: Failed working evidence prevents publication judgment
- **WHEN** apply completes but its selected working evidence fails
- **THEN** the working checkpoint fails and the sync turn is not run

### Requirement: Task-grounded evaluation identities
Black-box evaluation SHALL require an exact focused ID only when the task or pre-existing source prescribes it.

<!-- focused-spec:id=agent.eval.authored-identity -->
#### Scenario: Unspecified authored identity is retained through apply
- **WHEN** a blind proposal task prescribes no ID and the agent creates one valid native marker with a different valid name from historical examples
- **THEN** the proposal checkpoint accepts the authored name and subsequent judgment rejects a renamed or ambiguous binding instead of requiring an undisclosed fixed ID
- **AND** For new authoring without a prescribed ID, the evaluator SHALL accept exactly one valid newly authored native identity in the selected scope, retain that identity at the first successful checkpoint, and require subsequent apply and publication judgments to use the same identity. Missing, duplicate, invalid, or changed identities SHALL fail; selected evidence, behavior sensitivity, integrity, and planning boundaries SHALL remain independently judged.

<!-- focused-spec:id=agent.eval.prescribed-identity -->
#### Scenario: Existing identity cannot be replaced
- **WHEN** the task or starting source prescribes a focused ID and the agent replaces it with another valid ID
- **THEN** the evaluation rejects the replacement even when its evidence executes successfully

### Requirement: Discoverable genuine host authoring guidance
Native authoring fixtures SHALL expose applicable official host authoring guidance through the evaluated runtime's discovery mechanism, with source provenance and unchanged official workflow content.

<!-- focused-spec:id=agent.eval.host-guidance -->
#### Scenario: Installed authoring guidance is discoverable and actually read
- **WHEN** Spec Kit authoring guidance is installed for the evaluated runtime
- **THEN** the applicable authoring skill is discoverable and a successful read counts as guidance activation while installation-only, failed, incomplete, and lookalike reads do not
- **AND** Installation or orchestration instructions alone SHALL NOT count as specification-authoring guidance. Host integration guidance MAY identify host-owned generated artifacts and stable native-ID conventions without disclosing task-specific focused IDs or evidence selectors. Generated-source, approval, protected-file, and host-validation gates SHALL remain intact.

<!-- focused-spec:id=agent.eval.host-dialogue -->
#### Scenario: In-scope metadata review receives a real user reply
- **WHEN** a native authoring agent proposes a concrete evidence-metadata revision and stops for user confirmation
- **THEN** the bounded fixture conversation supplies an independent in-scope user reply without approving other paths or treating an unanswered question as completed authoring

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

### Requirement: Equivalent native rejection outcomes

Native outcome judgment SHALL recognize equivalent rejection wording, including denial, without requiring a hidden exact phrase. It SHALL still require the blocked-account condition, valid credentials, the rejection outcome in the same atomic native capability, exactly one applicable identity binding, and generated-source ownership constraints.

<!-- focused-spec:id=agent.eval.native-denial -->
#### Scenario: Generated denial wording retains one atomic outcome
- **WHEN** a generated BMad capability states that authentication returns denial for a blocked account with valid credentials
- **THEN** native authoring judgment accepts the uniquely bound unmarked capability and rejects omission of the valid-credentials condition, omission of rejection, duplicate native identity, or a generated-source marker

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

### Requirement: Self-guided authorized project upgrades
An explicit update SHALL upgrade the local package/integration, load fresh guidance and migrate config/format APIs. It SHALL preserve behavior, exact opaque scope-local IDs, evidence, AND obligations and runner settings. Explicit adapter selection MAY retain inline authoring; REVISES SHALL be removed without inheritance, identity loss or forced YAML conversion. Legacy APIs SHALL NOT remain runtime fallbacks.

<!-- focused-spec:id=agent.upgrade.preserve-project -->
#### Scenario: A bare update request completes a legacy project upgrade
- **WHEN** an agent receives only a request to update focused-spec in a runnable version-2 project with a legacy full-text skill
- **THEN** it upgrades the local package and installed loader, acquires fresh package-owned instructions, migrates each still-relevant occurrence to config 5 and Format API 2 with explicit format-owned evidence, retaining inline ID/EVIDENCE when selected, and successfully validates and executes all migrated evidence
- **AND** repeated IDs retain independent scope-local evidence rather than inherited REVISES relationships, which are removed after all still-relevant evidence has been inventoried; unrelated product, tests, runners, and integrations remain unchanged

### Requirement: Independently bounded upgrade evaluation
A blind upgrade evaluation SHALL start with a genuine published legacy package and skill and obtain the candidate through ordinary package-manager installation. Legitimate package/integration replacement SHALL be judged against an independently owned candidate artifact rather than exempted from integrity checks. Ordinary non-upgrade evaluations SHALL retain their existing protections.

<!-- focused-spec:id=agent.upgrade.reject-loss -->
#### Scenario: A green project cannot conceal migration loss or package tampering
- **WHEN** a migrated workspace loses or redirects an original scope-local evidence occurrence or modifies the candidate package after installation
- **THEN** independent upgrade gates reject completion even if its remaining focused evidence passes

### Requirement: Specification review reconciles enrolled evidence
An authorized enrolled specification revision SHALL reconcile its identity, binding and every evidence assertion with the revised outcome in its existing format-owned evidence location. Still-relevant outcomes and AND obligations SHALL survive. Retained green evidence SHALL NOT certify revised behavior without exact execution and changed-outcome sensitivity; completion SHALL validate the final selection.

<!-- focused-spec:id=agent.review.evidence-sync -->
#### Scenario: Revised behavior cannot retain stale green evidence
- **WHEN** an already-enrolled blocked-login outcome is revised to explicitly reject valid credentials but its registered tests still cover only invalid credentials
- **THEN** evaluation rejects unchanged green evidence and accepts the preserved identity only after both exact valid-credential tests are declared in the owning inline scenario or registry shard, execute and fail under the matching product regression, while unrelated registrations survive

### Requirement: Evidence reconciliation respects review phases
Read-only review SHALL report evidence gaps without writes. Planning-only work SHALL record deferred exact evidence changes without writing executable integration or claiming synchronization complete.

<!-- focused-spec:id=agent.review.phase-boundaries -->
#### Scenario: Review and planning do not authorize integration writes
- **WHEN** a read-only review or planning-only revision identifies necessary evidence changes
- **THEN** the workflow reports or plans those changes without writing registry, inline evidence integration, configuration, tests or product implementation, and does not claim the revised integration complete


### Requirement: On-demand integration selection
The universal workflow SHALL direct first integration and explicitly requested composition changes to the same installation's integration topic. It SHALL reuse supported configured choices for ordinary work instead of selecting a new architecture on every task. Topic responses SHALL receive the same complete-response, package, version and protocol checks as workflow guidance.

<!-- focused-spec:id=agent.integration.preserve-existing -->
#### Scenario: An ordinary task does not replace the configured composition
- **WHEN** an agent revises one outcome in an already configured supported inline, registry-backed or executable-scenario project
- **THEN** it preserves the canonical behavioral source and unaffected configuration, identities and evidence ownership instead of converting to its preferred format or reinstalling a different workflow

<!-- focused-spec:id=agent.integration.route-selection -->
#### Scenario: Missing integration leads to the package-owned selection procedure
- **WHEN** an agent is asked to choose a first focused-spec composition or explicitly reconsider an existing one, including adding an independent scenario SDK for SDK-only execution without focused configuration or CLI plugins
- **THEN** it acquires and validates the local CLI's complete integration topic before selecting a composition rather than guessing from a host name or requiring every plugin to be installed

### Requirement: Project-grounded composition choices
Integration guidance SHALL separate host process, canonical behavioral source, evidence ownership and execution runtime. Agents SHALL inspect project context and user intent before recommending the smallest compatible composition. Existing supported registrations take precedence; a host's name SHALL NOT mandate a parser, registry, inline dialect or SDK.

<!-- focused-spec:id=agent.integration.native-source -->
#### Scenario: Native acceptance items remain the source
- **WHEN** a project uses OpenSpec or Spec Kit native acceptance items and existing tests, without an authorized representation change
- **THEN** integration preserves those items and chooses compatible binding and execution capabilities without rewriting them into the inline dialect or copying them into SDK scenarios

<!-- focused-spec:id=agent.integration.standalone-choice -->
#### Scenario: Standalone needs do not require a host framework
- **WHEN** a project without a host framework requests standalone text scenarios or executable TypeScript or Go scenarios
- **THEN** the recommendation distinguishes inline text with test evidence from an independent language SDK, selects the path matching the requested source and runtime, and adds optional CLI format/runner packages only when CLI discovery and execution are requested
- **AND** The capability map SHALL remain illustrative rather than an allowlist. Compatible project-owned or third-party plugins SHALL remain eligible through their public contracts. Generated or metadata-hostile sources require a documented stable native identity; an unsupported binding SHALL be reported rather than guessed.

### Requirement: Phase-correct integration handoff
Reading integration guidance SHALL NOT authorize installation, configuration, migration or authoring. An installation-only request SHALL stop at verified core/agent setup with integration explicitly pending. Planning SHALL record the proposed composition and exact intended evidence without executable setup; authorized implementation SHALL obtain each selected installed package's public contract before configuration.

<!-- focused-spec:id=agent.integration.phase-boundaries -->
#### Scenario: Installation and recommendation do not silently configure evidence
- **WHEN** the agent is authorized only to install the CLI/agent integration or to recommend a composition
- **THEN** it makes no unauthorized plugin, configuration, specification, test or evidence changes and does not claim behavioral verification from guidance retrieval or installation

<!-- focused-spec:id=agent.integration.selected-contracts -->
#### Scenario: Orientation precedes selected package contracts
- **WHEN** integration requires a plugin not yet installed
- **THEN** the agent uses the core topic for preliminary orientation, installs only within authorization, acquires that installed package's exact public documentation before configuring it, and follows any explicitly documented composed-package dependency through a separate request
- **AND** Missing contracts or incompatible capabilities SHALL cause a revised recommendation or an explicit blocker, not invented syntax, implementation inspection, automatic package enumeration or silent fallback to another representation.

### Requirement: One canonical independently checkable source
The strengthened workflow SHALL treat native text items and executable code scenarios as alternative canonical sources, preserving one independently failing outcome per item. Evidence, drivers, wrappers and diagnostics SHALL NOT become duplicate behavioral specifications. A representation change SHALL require explicit authorization and preserve surviving identity and evidence obligations.

<!-- focused-spec:id=agent.workflow.single-source -->
#### Scenario: Executable scenarios do not acquire a Markdown copy
- **WHEN** an authorized task adds or revises an independently executable scenario suite
- **THEN** behavior remains in that suite, ordinary test wrappers and optional focused execution reuse it, and no companion Markdown specification or registry is created merely to satisfy a text-oriented workflow

### Requirement: Application-grounded observations and independent expectations
The workflow SHALL identify the actual application boundary and an expected outcome authored independently of the observed execution. A driver SHALL prepare, invoke and observe the application rather than reimplement its decision or return the expectation. Deterministic observation projections SHALL preserve every claimed observable distinction; identical observations for correct and incorrect behavior SHALL NOT certify the claim.

<!-- focused-spec:id=agent.workflow.application-boundary -->
#### Scenario: A driver cannot replace the product under verification
- **WHEN** a driver reproduces the product rule locally or returns a preconstructed expected result while the real application violates the selected outcome
- **THEN** workflow completion is rejected until selected execution exercises the real application and a controlled regression of that application causes the selected behavioral assertion to fail

<!-- focused-spec:id=agent.workflow.independent-oracle -->
#### Scenario: Observed output cannot define its own expectation
- **WHEN** a proposed scenario derives its expected result from the same execution being verified or projects away the changed outcome
- **THEN** the agent repairs the authorized expectation or observation to protect the native claim and proves product-regression sensitivity without weakening the assertion or changing the selected identity to obtain a pass

### Requirement: Diagnostic output does not substitute for proof
The workflow SHALL distinguish discovery, validation, execution, comparison, explanations and codec checks. Native claims and application assertions determine proof; events and explanations do not. A codec roundtrip alone SHALL NOT certify application behavior or historical wire compatibility. Existing exact-evidence, AND, phase, sensitivity and host-lifecycle requirements remain applicable.

<!-- focused-spec:id=agent.workflow.proof-not-diagnostics -->
#### Scenario: Plausible explanations do not override a failed comparison
- **WHEN** an execution emits expected-looking explanations or passes a message roundtrip while the real selected application observation is wrong
- **THEN** the workflow reports the behavioral failure and does not claim completion from those diagnostic or serialization results
- **AND** SDK-only work SHALL execute its selected native suite without requiring focused-spec installation. When CLI integration is requested, selected focused evidence and the completed configured scope SHALL also execute. Sensitivity remains exact PASS, selected behavioral FAIL under a reversible product regression, then restored PASS; runner errors, missing targets, skips and unrelated failures SHALL NOT count.

