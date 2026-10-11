## ADDED Requirements

### Requirement: Offline package-owned guidance
The CLI SHALL provide `instructions [--protocol <version>] [--topic workflow|runners] [--json]` independently of project configuration, evidence registries, native documents, runners, and network access.


<!-- focused-spec:id=guidance.delivery.offline -->
#### Scenario: Workflow is available before project setup
- **WHEN** the installed CLI's workflow guidance is requested offline in an unconfigured consumer project
- **THEN** the command successfully returns its own package's authoritative workflow without performing project setup or evidence execution
- **AND** The default protocol SHALL be 1 and the default topic SHALL be `workflow`. Guidance and package identity SHALL come from the package owning the invoked CLI, not the current directory, another CLI on PATH, or a remotely downloaded release. Reading guidance SHALL NOT install or modify project or agent files and SHALL NOT count as validation or executable evidence. The command name SHALL be `instructions` only; the previous `agent-guide` invocation and its help forms SHALL fail as unknown commands rather than remain compatibility aliases.

<!-- focused-spec:id=guidance.delivery.runners -->
#### Scenario: Runner guidance is available on demand
- **WHEN** the installed CLI is asked for the `runners` topic
- **THEN** it returns the same package's complete runner authoring and verification guidance without requiring access to the focused-spec source repository

<!-- focused-spec:id=guidance.delivery.command-name -->
#### Scenario: The previous command is not a compatibility alias
- **WHEN** a consumer invokes the previous `agent-guide` command or requests its command-specific help
- **THEN** the CLI rejects the invocation with a nonzero exit and no usable guidance while directing the consumer to current command help

### Requirement: Versioned guidance response
For protocol 1, JSON output SHALL be one object with `protocolVersion: 1`, `package: { name: "focused-spec", version: <installed package version> }`, `topic: "workflow" | "runners"`, and nonempty Markdown `content`.


<!-- focused-spec:id=guidance.delivery.compatible-update -->
#### Scenario: An unchanged loader receives an updated package's guidance
- **WHEN** a consumer replaces one protocol-1 package with another protocol-1 package while retaining the same loader request
- **THEN** the next guidance request returns the replacement package's version and workflow rather than the previous installation's instructions
- **AND** Text output SHALL identify the serving package version, protocol, and topic and contain the corresponding guidance. Package versions, configuration versions, and runner API versions SHALL NOT be interpreted as loader protocol versions. A compatible package update SHALL NOT require changing the loader merely because the package version changed.

### Requirement: Incompatible requests fail closed
Unsupported protocol versions, malformed or missing option values, unknown topics, and options belonging to other commands SHALL cause a nonzero exit with an actionable stderr diagnostic and no usable guidance on stdout. An unsupported protocol diagnostic SHALL identify the requested and supported protocol versions. The CLI SHALL NOT substitute its default protocol for an explicit unsupported request.

<!-- focused-spec:id=guidance.delivery.incompatible-protocol -->
#### Scenario: A newer loader cannot silently use an older protocol
- **WHEN** a loader explicitly requests a protocol the installed CLI does not support
- **THEN** the command fails without returning workflow content and identifies the compatibility mismatch

<!-- focused-spec:id=guidance.delivery.invalid-request -->
#### Scenario: Invalid guidance options cannot produce instructions
- **WHEN** a guidance request supplies an unknown topic, an invalid protocol value, or a validation-only option
- **THEN** the CLI rejects that request with the guidance help pointer instead of returning instructions

### Requirement: Missing package guidance fails explicitly
If the requested authoritative guidance cannot be read or is empty, the command SHALL fail without usable guidance on stdout and identify an incomplete installed package. It SHALL NOT use a separately installed skill, repository checkout, another topic, or another CLI as a fallback.

<!-- focused-spec:id=guidance.delivery.incomplete-package -->
#### Scenario: An incomplete installation cannot fall back to stale instructions
- **WHEN** a consumer requests a guidance topic whose asset is absent from the installed package
- **THEN** the CLI reports the incomplete installation and returns no replacement workflow from another source
