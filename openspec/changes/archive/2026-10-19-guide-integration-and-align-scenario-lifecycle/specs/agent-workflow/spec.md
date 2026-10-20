# Spec Delta

## ADDED Requirements

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
