# distribution Specification

## Purpose

Consumer installation, CLI and type exports, and independent agent skill setup.

## Requirements

### Requirement: Node package distribution
The package SHALL install in Node.js 22.16.0+ consumers with a `focused-spec` CLI, compiled runtime and public `focused-spec` and `focused-spec/runner` entry points. Building a Git checkout or npm pack SHALL produce the same runnable package contents.

<!-- focused-spec:id=distribution.package.cli -->
#### Scenario: Packed CLI runs in a consumer project
- **WHEN** a consumer installs the packed package as a development dependency
- **THEN** its installed CLI can validate and execute a native item with version-3 configuration and registry evidence without reading this repository's source tree

<!-- focused-spec:id=distribution.package.runner-api -->
#### Scenario: Runner types are available from the declared subpath
- **WHEN** a consumer imports `RunnerPlugin` as a type from `focused-spec/runner`
- **THEN** the plugin typechecks against the published runner contract without internal source imports

### Requirement: Skill installation is separate
Installing the CLI SHALL NOT silently install an agent skill or manufacture a framework runner. The focused-spec skill SHALL be installable separately for supported agents.

<!-- focused-spec:id=distribution.skill.separate-install -->
#### Scenario: CLI installation has no agent side effects
- **WHEN** a consumer installs only the npm package
- **THEN** no agent skill or project-specific runner is created in the consumer project

### Requirement: CLI-owned workflow and separate loader
The npm package SHALL contain the authoritative focused-spec workflow and runner guidance required by `instructions`, together with an independently installable focused-spec loader skill.


<!-- focused-spec:id=distribution.package.agent-guidance -->
#### Scenario: Packed guidance works independently of the source checkout
- **WHEN** a consumer installs the packed package in a disposable project without access to the source checkout
- **THEN** its installed CLI supplies both guidance topics and its skill remains separately discoverable without creating agent files in the consumer project
- **AND** The loader SHALL preserve installer-readable discovery metadata but SHALL NOT embed a second maintained copy of the workflow or runner guidance. Consumer guidance access SHALL NOT require this repository's documentation or source. CLI installation SHALL remain separate from skill activation and SHALL NOT rewrite installed agent instructions or local customizations. The package SHALL ship only the new loader and CLI-owned guidance format, without legacy full-text skill copies, obsolete format readers, aliases, conversion tooling, or compatibility shims. Consumer-project migration SHALL remain separately requested agent work rather than an installation side effect.
