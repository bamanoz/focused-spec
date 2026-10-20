# Spec Delta

## MODIFIED Requirements

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

### Requirement: Self-guided authorized project upgrades
An explicitly requested update SHALL upgrade the local package and integration, load fresh guidance and migrate required config/format APIs. It SHALL preserve behavior, opaque scope-local IDs, exact evidence, AND obligations and runner settings. Supported inline authoring MAY remain inline through explicit adapter selection; REVISES SHALL be removed without inheritance, identity loss or forced YAML conversion. Legacy APIs SHALL not remain runtime fallbacks.

<!-- focused-spec:id=agent.upgrade.preserve-project -->
#### Scenario: A bare update request completes a legacy project upgrade
- **WHEN** an agent receives only a request to update focused-spec in a runnable version-2 project with a legacy full-text skill
- **THEN** it upgrades the local package and installed loader, acquires fresh package-owned instructions, migrates each still-relevant occurrence to config 5 and Format API 2 with explicit format-owned evidence, retaining inline ID/EVIDENCE when selected, and successfully validates and executes all migrated evidence
- **AND** repeated IDs retain independent scope-local evidence rather than inherited REVISES relationships, which are removed after all still-relevant evidence has been inventoried; unrelated product, tests, runners, and integrations remain unchanged

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
