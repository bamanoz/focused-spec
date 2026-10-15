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

## ADDED Requirements

### Requirement: Plugin-independent shared guidance
The workflow, formats and runners topics SHALL retain shared core contracts and verification rules without bundled catalogs, dialects or framework-specific procedures. They SHALL direct agents to explicit installed plugin documentation with provenance; composed plugins remain responsible for explaining their own nested configuration, followed through separate agent requests rather than core discovery.

<!-- focused-spec:id=guidance.plugins.public-contracts -->
#### Scenario: Agent-facing contracts come from selected installed plugins
- **WHEN** an agent uses the shared guidance to acquire documentation for a selected composing format and its parser
- **THEN** the installed CLI supplies each package's independently owned complete contract through explicit requests without a core-maintained plugin allowlist, plugin imports, or automatic nested aggregation
