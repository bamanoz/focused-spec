# agent-guidance Specification

## Purpose

Offline package-owned agent guidance with explicit loader compatibility and installation provenance.

## Requirements

### Requirement: Offline package-owned guidance
The CLI SHALL serve offline package-owned guidance through `instructions [--protocol <version>] [--topic <topic>] [--json]` without project configuration, evidence, documents, plugins, or network access. Topics SHALL be `workflow`, `review`, `author-revise`, `upgrade`, `verify`, `integration`, `formats`, and `runners`. The selected installation MAY be project-local, global, or explicitly located; project ownership SHALL NOT be required.

<!-- focused-spec:id=guidance.delivery.offline -->
#### Scenario: Workflow is available before project setup
- **WHEN** the installed CLI's workflow guidance is requested offline in an unconfigured consumer project
- **THEN** the command successfully returns its own package's authoritative workflow without performing project setup or evidence execution
- **AND** The default protocol SHALL be 1 and the default topic SHALL be `workflow`. Guidance and package identity SHALL come from the package owning the invoked CLI, not the current directory, another CLI on PATH, or a remotely downloaded release. Reading guidance SHALL NOT install or modify project or agent files and SHALL NOT count as validation or executable evidence. The command name SHALL be `instructions` only; the previous `agent-guide` invocation and its help forms SHALL fail as unknown commands rather than remain compatibility aliases.

<!-- focused-spec:id=guidance.delivery.runners -->
#### Scenario: Runner guidance is available on demand
- **WHEN** the installed CLI is asked for the `runners` topic
- **THEN** it returns the same package's complete shared runner authoring and verification guidance without requiring access to the focused-spec source repository or bundling framework-specific contracts

<!-- focused-spec:id=guidance.delivery.formats -->
#### Scenario: Format guidance is available before project setup
- **WHEN** an offline consumer requests `instructions --protocol 1 --topic formats` with invalid project configuration and no usable format plugins
- **THEN** the CLI returns its own package's shared format selection, authoring, and verification guidance without loading project configuration or plugins, executing evidence, or writing project files
- **AND** The guidance SHALL direct consumers to the selected installed plugins' public contracts through explicit documentation requests rather than bundling official-adapter reference syntax or dynamically aggregating plugin documentation.

<!-- focused-spec:id=guidance.delivery.command-name -->
#### Scenario: The previous command is not a compatibility alias
- **WHEN** a consumer invokes the previous `agent-guide` command or requests its command-specific help
- **THEN** the CLI rejects the invocation with a nonzero exit and no usable guidance while directing the consumer to current command help

<!-- focused-spec:id=guidance.delivery.integration -->
#### Scenario: Core alone supplies integration guidance
- **WHEN** an offline consumer with only the packed core installed requests the integration topic beside absent or malformed project configuration and no installed plugins
- **THEN** text and protocol-1 JSON output deliver the serving package's complete integration guidance without reading project configuration, resolving or importing plugins, downloading packages, executing evidence or writing files
- **AND** The guidance SHALL provide a compact nonexclusive map of behavioral-source, evidence and execution choices, distinguish SDK-only execution from optional CLI integration, and refer concrete syntax and selectors to the selected package's public contract. It SHALL NOT require repository documentation or a network connection to understand the selection procedure.

<!-- focused-spec:id=guidance.delivery.installation-independent -->
#### Scenario: An external installation serves its own guidance
- **WHEN** a consumer invokes a compatible installed CLI outside the project, with no project-local CLI or with a different project-local CLI present
- **THEN** the invoked CLI returns its own package identity and guidance without requiring project ownership or substituting the project's installation
- **AND** Configuration and plugin resolution SHALL remain relative to the consuming project root, not the CLI installation.

<!-- focused-spec:id=guidance.delivery.focused-topic -->
#### Scenario: Focused guidance is available without loading project state
- **WHEN** an offline consumer requests `review`, `author-revise`, `upgrade`, or `verify` with invalid project configuration
- **THEN** the CLI returns the selected package-owned topic without reading configuration, loading plugins, executing evidence, or writing project files
- **AND** each topic SHALL contain the obligations specific to its route and SHALL direct selected format and runner work to their existing public-contract requests.

### Requirement: Versioned guidance response
For protocol 1, JSON output SHALL be one object with `protocolVersion: 1`, `package: { name: "focused-spec", version: <installed package version> }`, `topic: "workflow" | "review" | "author-revise" | "upgrade" | "verify" | "integration" | "formats" | "runners"`, and nonempty Markdown `content`.

<!-- focused-spec:id=guidance.delivery.compatible-update -->
#### Scenario: An unchanged loader receives an updated package's guidance
- **WHEN** a consumer replaces one protocol-1 package with another protocol-1 package while retaining the same loader request
- **THEN** the next guidance request returns the replacement package's version and requested topic rather than the previous installation's instructions
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

<!-- focused-spec:id=guidance.delivery.formats-incomplete -->
#### Scenario: Missing format guidance cannot fall back to workflow or plugin documentation
- **WHEN** the installed package lacks its formats guidance but workflow, runners, and project-local replacement documentation are available
- **THEN** requesting formats exits nonzero with an incomplete-installation diagnostic and no usable guidance on stdout

<!-- focused-spec:id=guidance.delivery.integration-incomplete -->
#### Scenario: Integration guidance cannot be substituted
- **WHEN** the installed package's integration guidance is missing or empty while other topics and project-local replacement instructions remain available
- **THEN** requesting integration exits nonzero with an incomplete-installation diagnostic and empty stdout rather than substituting another source

### Requirement: Actionable obsolete-format guidance
The CLI SHALL reject obsolete config/format APIs, unsupported REVISES and inline metadata selected through a non-inline format with a concrete project-local protocol-1 workflow command. Explicit API-2 inline ID/EVIDENCE SHALL be supported, not reported as obsolete. Guidance SHALL remain available without loading invalid configuration or executing evidence.

<!-- focused-spec:id=guidance.upgrade.obsolete-format -->
#### Scenario: Obsolete formats lead to usable instructions
- **WHEN** a consumer validates config versions 1–4, Format API 1, REVISES, or inline ID/EVIDENCE without selecting the inline adapter
- **THEN** the diagnostic advertises a local instruction command which returns the serving package's complete workflow despite the invalid configuration, API or authoring-format selection


### Requirement: Plugin-independent shared guidance
The workflow router and shared topics SHALL retain package-owned contracts and verification boundaries without plugin catalogs, dialects, or framework-specific procedures. They SHALL direct explicit installed plugin documentation requests with provenance; composed plugins SHALL document nested options for separate requests, not core discovery. The loader SHALL contain only activation and routing, not duplicate procedure.

<!-- focused-spec:id=guidance.plugins.public-contracts -->
#### Scenario: Agent-facing contracts come from selected installed plugins
- **WHEN** an agent uses the shared guidance to acquire documentation for a selected composing format and its parser
- **THEN** the installed CLI supplies each package's independently owned complete contract through explicit requests without a core-maintained plugin allowlist, plugin imports, or automatic nested aggregation

<!-- focused-spec:id=guidance.plugins.router -->
#### Scenario: The loader routes to package-owned focused guidance
- **WHEN** an agent loads the installed skill for a focused-spec workflow step and the router selects a review, author-revise, upgrade, or verify operation
- **THEN** the agent requests that topic from the same selected installed CLI rather than relying on procedure embedded in the loader or a truncated workflow response

