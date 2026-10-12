# distribution Specification

## Purpose

Consumer installation, CLI and type exports, and independent agent skill setup.

## Requirements

### Requirement: Node package distribution
The package SHALL install in Node.js 22.16.0+ consumers with a `focused-spec` CLI, compiled runtime and public `focused-spec`, `focused-spec/format` and `focused-spec/runner` entry points. Building a Git checkout or npm pack SHALL produce the same runnable package contents.

<!-- focused-spec:id=distribution.package.cli -->
#### Scenario: Packed CLI runs in a consumer project
- **WHEN** a consumer installs the packed package as a development dependency
- **THEN** its installed CLI can validate and execute a native item with version-4 configuration with explicitly installed format adapters and registry evidence without reading this repository's source tree

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

### Requirement: Independently installed adapters
The core SHALL not install Markdown, Gherkin or test framework implementations. Official formats and runners SHALL be separately installable packages with compiled ESM runtime and type declarations. Repository workspace installation SHALL use local packages without requiring their prior registry publication.

<!-- focused-spec:id=distribution.adapters.independent -->
#### Scenario: Core-only and adapter consumer installations
- **WHEN** a consumer installs the core alone and later installs selected format and runner packages
- **THEN** the first installation has no parser dependencies or fallback, and the selected packages enable native evidence execution independently of the source checkout

### Requirement: Public installed runner contracts

Each official runner package SHALL make its selector syntax, supported framework and command options available as public package documentation, independently of source-checkout access. Consumers SHALL be able to select and execute real evidence from documented examples without inspecting plugin implementation.

<!-- focused-spec:id=distribution.runner.public-contracts -->
#### Scenario: Installed documentation supplies executable selectors
- **WHEN** a consumer installs independently packed official runner packages and chooses selectors from their public documentation
- **THEN** the documented selectors resolve and execute the selected real tests, and a controlled product regression makes that evidence fail rather than pass
