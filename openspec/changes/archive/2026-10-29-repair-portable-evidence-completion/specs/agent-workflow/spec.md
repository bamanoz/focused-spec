# Agent workflow delta

## MODIFIED Requirements

### Requirement: Installed guidance bootstrap
The focused-spec loader SHALL obtain standalone protocol-1 JSON workflow guidance from a selected installed CLI before each focused-spec workflow step. The selected CLI MAY be project-local, global, or explicitly located. Guidance SHALL belong to that executable's package, while configuration and plugins SHALL resolve from the consuming project root. Evaluation SHALL resolve executable selection using the evaluated driver's effective search environment.

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

<!-- focused-spec:id=agent.guidance.effective-path -->
#### Scenario: Bare executable resolution matches the evaluated driver
- **WHEN** an evaluated agent successfully requests guidance through a bare executable that its driver resolves from the consuming project's executable directory ahead of the supervisor's search path
- **THEN** the acquisition gate compares the delivered response with that serving installation rather than rejecting it or substituting an installation selected by the supervisor
- **AND** An earlier non-focused executable shadow SHALL remain a failure, and an explicitly selected external executable SHALL retain its own identity.

<!-- focused-spec:id=agent.guidance.standalone-request -->
#### Scenario: A chained acquisition requires a fresh standalone request
- **WHEN** an agent combines a guidance request with executable discovery, version checks, or another command
- **THEN** it requests that topic again by itself before proceeding; a full artifact from the combined invocation does not certify acquisition

<!-- focused-spec:id=agent.guidance.artifact-recovery -->
#### Scenario: Complete linked output establishes acquisition
- **WHEN** a successful standalone guidance response is clipped and a subsequent completed read recovers that call's complete matching response from its linked artifact
- **THEN** the acquisition gate accepts the valid serving-package protocol response while rejecting missing, failed, incomplete, premature, unrelated, or mismatched recovery

### Requirement: On-demand integration selection
The universal workflow SHALL direct first integration and explicitly requested composition changes to the same installation's integration topic before selecting or installing execution dependencies. It SHALL reuse supported established choices for ordinary work instead of selecting a new architecture on every task. Topic responses SHALL receive the same complete-response, package, version and protocol checks as workflow guidance.

<!-- focused-spec:id=agent.integration.preserve-existing -->
#### Scenario: An ordinary task does not replace the configured composition
- **WHEN** an agent revises one outcome in an already configured supported inline, registry-backed or executable-scenario project
- **THEN** it preserves the canonical behavioral source and unaffected configuration, identities and evidence ownership instead of converting to its preferred format or reinstalling a different workflow

<!-- focused-spec:id=agent.integration.route-selection -->
#### Scenario: Missing integration leads to the package-owned selection procedure
- **WHEN** an agent is asked to choose a first focused-spec composition or explicitly reconsider an existing one, including adding an independent scenario SDK for SDK-only execution without focused configuration or CLI plugins
- **THEN** it acquires and validates the selected CLI's complete integration topic before selecting a composition rather than guessing from a host name or requiring every plugin to be installed

<!-- focused-spec:id=agent.integration.missing-dependency -->
#### Scenario: An absent execution dependency requires a grounded composition decision
- **WHEN** scenario authoring encounters an absent execution dependency
- **THEN** the agent checks the manifest, lockfile, existing configuration and suite to distinguish repair of an established compatible composition from first selection, and acquires integration guidance before a first selection or composition change
- **AND** Reinstalling a dependency already selected by the project SHALL NOT alone imply a new composition; a first SDK-only selection SHALL NOT be exempt merely because no CLI configuration is requested.

## ADDED Requirements

### Requirement: Authorization-grounded native enrollment completion
Before changing a native behavioral item, authoring SHALL establish the requested outcome, actual host phase and permissions, and applicable identity/evidence obligations. It SHALL include required auxiliary integration in a concrete approval proposal when approval is needed. Existing implementation, tests, a wording-only edit, or absent enrollment SHALL NOT by themselves establish a planning-only restriction or remove required work.

<!-- focused-spec:id=agent.author.complete-proposal -->
#### Scenario: Approval covers the complete discovered revision
- **WHEN** a requested native revision needs identity or evidence metadata and the host requires confirmation
- **THEN** the agent proposes the native revision, exact identity, all required evidence members, final selectors and complete affected paths together rather than recommending an unenrolled wording-only substitute as completed integration

<!-- focused-spec:id=agent.author.real-phase-boundary -->
#### Scenario: A genuine planning boundary defers rather than drops evidence
- **WHEN** the host explicitly restricts the current operation to planning, or the user explicitly excludes required integration edits
- **THEN** the agent respects that boundary, records the exact remaining work and missing authorization, and does not write executable integration or claim synchronized completion
- **AND** Without such a restriction, existing implementation and tests SHALL NOT justify inventing a later permission requirement for otherwise authorized enrollment and verification.

<!-- focused-spec:id=agent.author.enroll-before-completion -->
#### Scenario: Existing tests do not substitute for enrollment and execution
- **WHEN** authorized native authoring has suitable existing tests but the changed item is not yet enrolled
- **THEN** completion requires the documented native binding, every selected evidence member, configured execution, controlled product-regression sensitivity with exact restoration, and completed-scope execution; ordinary test passes or host validation alone do not complete integration

### Requirement: Outcome-preserving evaluation dialogue
A tool-free evaluation test user SHALL answer from the original task and conversation while preserving the requested outcome. It SHALL NOT select an assistant-offered narrower substitute merely because it is recommended, invent undisclosed integration mechanics, or grant writes through clarification instead of genuine approval.

<!-- focused-spec:id=agent.eval.dialogue-outcome -->
#### Scenario: A recommended scope reduction is not implied consent
- **WHEN** an authoring agent offers wording-only completion instead of required auxiliary work it has already identified as part of the requested outcome
- **THEN** the test user retains that outcome or requests a concrete complete proposal using only disclosed information, without suggesting hidden paths, selectors, skills or commands
- **AND** Clarification SHALL NOT authorize file writes; genuine plan/path approval and explicit cancellation or refinement SHALL remain independently enforced.

### Requirement: Prerequisite-aware native outcome diagnostics
Native authoring evaluation SHALL distinguish missing or ambiguous identity/binding from a judged behavioral mismatch. If a unique bound native item is unavailable, its bound-outcome check SHALL be reported as unjudged rather than as evidence that native behavior was lost. Missing enrollment SHALL still fail authoring and prevent unsupported execution claims.

<!-- focused-spec:id=agent.eval.bound-outcome-prerequisite -->
#### Scenario: Missing enrollment does not imply lost native prose
- **WHEN** revised native prose expresses the requested outcome but no unique native identity or evidence binding selects it
- **THEN** authoring fails for the missing binding and reports its bound outcome as unjudged, while selection-dependent execution remains unverified
- **AND** Once uniquely bound, an incorrect outcome SHALL fail its behavioral check; a correct outcome SHALL NOT by itself certify evidence execution or sensitivity.

### Requirement: Outcome-based integration evaluation
Integration task success SHALL be determined by the requested composition, authorization boundaries, protected-state integrity, native behavioral source, actual execution and application-regression sensitivity. Integration-topic acquisition SHALL be recorded separately as a procedural observation and SHALL NOT by itself fail a correctly completed task.

<!-- focused-spec:id=agent.eval.integration-outcome -->
#### Scenario: A correct SDK repair does not fail for an unread integration topic
- **WHEN** an agent installs the correct execution SDK and repairs the real application driver without acquiring the integration topic
- **THEN** the task passes only if its composition, boundaries, independent expectations, execution and regression sensitivity pass, while the missing acquisition remains a false observation outside the success gates
- **AND** Reading the integration topic SHALL NOT rescue a false-green driver, incorrect composition, unauthorized change, failed execution or insensitive assertion. Historical scores SHALL remain immutable.
