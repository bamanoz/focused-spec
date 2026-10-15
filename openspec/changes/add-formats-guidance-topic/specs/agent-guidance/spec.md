# Spec Delta

## MODIFIED Requirements

### Requirement: Offline package-owned guidance
The CLI SHALL provide `instructions [--protocol <version>] [--topic workflow|formats|runners] [--json]` independently of project configuration, evidence registries, native documents, plugins, and network access.

<!-- focused-spec:id=guidance.delivery.offline -->
#### Scenario: Workflow is available before project setup
- **WHEN** the installed CLI's workflow guidance is requested offline in an unconfigured consumer project
- **THEN** the command successfully returns its own package's authoritative workflow without performing project setup or evidence execution
- **AND** The default protocol SHALL be 1 and the default topic SHALL be `workflow`. Guidance and package identity SHALL come from the package owning the invoked CLI, not the current directory, another CLI on PATH, or a remotely downloaded release. Reading guidance SHALL NOT install or modify project or agent files and SHALL NOT count as validation or executable evidence. The command name SHALL be `instructions` only; the previous `agent-guide` invocation and its help forms SHALL fail as unknown commands rather than remain compatibility aliases.

<!-- focused-spec:id=guidance.delivery.runners -->
#### Scenario: Runner guidance is available on demand
- **WHEN** the installed CLI is asked for the `runners` topic
- **THEN** it returns the same package's complete runner authoring and verification guidance without requiring access to the focused-spec source repository

<!-- focused-spec:id=guidance.delivery.formats -->
#### Scenario: Format guidance is available before project setup
- **WHEN** an offline consumer requests `instructions --protocol 1 --topic formats` with invalid project configuration and no usable format plugins
- **THEN** the CLI returns its own package's format selection, authoring, and verification guidance without loading project configuration or plugins, executing evidence, or writing project files
- **AND** The guidance SHALL distinguish common Format API 2 enrollment rules from the named official adapters' reference and direct consumers to selected third-party plugins' public contracts without treating official packages as an allowlist or dynamically collecting plugin documentation.

<!-- focused-spec:id=guidance.delivery.command-name -->
#### Scenario: The previous command is not a compatibility alias
- **WHEN** a consumer invokes the previous `agent-guide` command or requests its command-specific help
- **THEN** the CLI rejects the invocation with a nonzero exit and no usable guidance while directing the consumer to current command help

### Requirement: Versioned guidance response
For protocol 1, JSON output SHALL be one object with `protocolVersion: 1`, `package: { name: "focused-spec", version: <installed package version> }`, `topic: "workflow" | "formats" | "runners"`, and nonempty Markdown `content`.

<!-- focused-spec:id=guidance.delivery.compatible-update -->
#### Scenario: An unchanged loader receives an updated package's guidance
- **WHEN** a consumer replaces one protocol-1 package with another protocol-1 package while retaining the same loader request
- **THEN** the next guidance request returns the replacement package's version and workflow rather than the previous installation's instructions
- **AND** Text output SHALL identify the serving package version, protocol, and topic and contain the corresponding guidance. Package versions, configuration versions, and runner API versions SHALL NOT be interpreted as loader protocol versions. A compatible package update SHALL NOT require changing the loader merely because the package version changed.

### Requirement: Missing package guidance fails explicitly
If the requested authoritative guidance cannot be read or is empty, the command SHALL fail without usable guidance on stdout and identify an incomplete installed package. It SHALL NOT use a separately installed skill, repository checkout, another topic, or another CLI as a fallback.

<!-- focused-spec:id=guidance.delivery.incomplete-package -->
#### Scenario: An incomplete installation cannot fall back to stale instructions
- **WHEN** a consumer requests a guidance topic whose asset is absent from the installed package
- **THEN** the CLI reports the incomplete installation and returns no replacement workflow from another source

<!-- focused-spec:id=guidance.delivery.formats-incomplete -->
#### Scenario: Missing format guidance cannot fall back to workflow or plugin documentation
- **WHEN** the installed package lacks its formats guidance but workflow, runners, and project-local replacement documentation are available
- **THEN** requesting formats exits nonzero with an incomplete-installation diagnostic and no usable guidance on stdout
