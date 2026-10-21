# Spec Delta

## ADDED Requirements

### Requirement: Workflow-independent BDD and SDD skill activation
Agents SHALL load the installed focused-spec skill before reviewing, authoring, revising, or verifying BDD executable scenarios or their application drivers, and before SDD steps concerning behavioral requirements or scenarios. Loading SHALL NOT depend on a named framework, artifact format, explicit skill invocation, or the user mentioning focused-spec. Host procedures SHALL apply when present, without making a host mandatory for BDD work.

<!-- focused-spec:id=agent.activation.bdd-sdk -->
#### Scenario: Standalone SDK scenarios activate the skill
- **WHEN** a user asks the agent to make a native code scenario suite independently runnable through its language SDK and ordinary tests, without an SDD host or CLI integration
- **THEN** the agent reads the installed skill and obtains current workflow guidance from the explicitly resolved project-local installation before performing the authorized scenario work
- **AND** the agent executes the native suite without adding a Markdown companion, registry, focused-spec configuration, or CLI plugins merely to satisfy loading
- **AND** the user is not required to invoke focused-spec or the skill manually

<!-- focused-spec:id=agent.activation.bdd-driver -->
#### Scenario: Application driver repair activates the skill without a product keyword
- **WHEN** a user asks the agent to repair an executable scenario driver that returns expected results instead of observing the real application, without naming focused-spec or SDD
- **THEN** the agent loads the skill and acquires current local workflow guidance before changing the driver
- **AND** it retains independently authored expectations and one native suite, and proves the claimed application outcome through native execution and a reversible product regression rather than accepting an expectation echo

<!-- focused-spec:id=agent.activation.sdd -->
#### Scenario: Broader activation retains host workflow boundaries
- **WHEN** an agent reviews or plans behavioral requirements in an existing SDD workflow without the user invoking focused-spec
- **THEN** it loads focused-spec alongside the applicable host workflow and acquires current project-local guidance
- **AND** loading does not authorize writes in read-only review or implementation and executable integration during a planning-only phase
- **AND** the host continues to own its approval and lifecycle operations
