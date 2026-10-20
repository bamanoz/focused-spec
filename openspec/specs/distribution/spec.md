# distribution Specification

## Purpose

Consumer installation, CLI and type exports, and independent agent skill setup.

## Requirements

### Requirement: Node package distribution
The package SHALL install in Node.js 22.16.0+ consumers with a `focused-spec` CLI, compiled runtime and public `focused-spec`, `focused-spec/format` and `focused-spec/runner` entry points. Building a Git checkout or npm pack SHALL produce the same runnable package contents.

<!-- focused-spec:id=distribution.package.cli -->
#### Scenario: Packed CLI runs in a consumer project
- **WHEN** a consumer installs the packed package as a development dependency
- **THEN** its installed CLI can validate and execute a native item with version-5 configuration and explicitly installed format adapters with normalized evidence without reading this repository's source tree

<!-- focused-spec:id=distribution.package.runner-api -->
#### Scenario: Runner types are available from the declared subpath
- **WHEN** a consumer imports `RunnerPlugin` as a type from `focused-spec/runner`
- **THEN** the plugin typechecks against the published runner contract without internal source imports

<!-- focused-spec:id=distribution.package.retired-assets -->
#### Scenario: Rebuild removes retired generated assets
- **WHEN** a generated package asset no longer exists in its authored owner before repeated staging
- **THEN** the rebuilt package omits the retired asset and retains current authored contents

<!-- focused-spec:id=distribution.package.retired-runtime -->
#### Scenario: Rebuild removes retired runtime outputs
- **WHEN** an authored runtime module is removed before the next package build
- **THEN** the resulting package no longer contains its retired compiled runtime or declaration

<!-- focused-spec:id=distribution.package.format-api-two -->
#### Scenario: Consumers implement the public storage-independent API
- **WHEN** a consumer imports the public Format API 2 types and implements parsing plus catalog binding against independently packed packages
- **THEN** the format typechecks without internal imports and executes normalized evidence while Runner API 1 remains available

### Requirement: Skill installation is separate
Installing the CLI SHALL NOT silently install an agent skill or manufacture a framework runner. The focused-spec skill SHALL be installable separately for supported agents.

<!-- focused-spec:id=distribution.skill.separate-install -->
#### Scenario: CLI installation has no agent side effects
- **WHEN** a consumer installs only the npm package
- **THEN** no agent skill or project-specific runner is created in the consumer project

### Requirement: CLI-owned workflow and separate loader
The npm package SHALL contain the authoritative focused-spec workflow, format guidance, and runner guidance required by `instructions`, together with an independently installable focused-spec loader skill. The loader SHALL acquire the applicable on-demand `formats` or `runners` topic from the same project-local installation when the accepted workflow calls for that plugin work.

<!-- focused-spec:id=distribution.package.agent-guidance -->
#### Scenario: Packed guidance works independently of the source checkout
- **WHEN** a consumer installs the packed package in a disposable project without access to the source checkout
- **THEN** its installed CLI supplies workflow, formats, and runners guidance in JSON and text, and its skill remains separately discoverable without creating agent files in the consumer project
- **AND** The loader SHALL preserve installer-readable discovery metadata but SHALL NOT embed a second maintained copy of workflow, format, or runner guidance. Consumer guidance access SHALL NOT require this repository's documentation or source. CLI installation SHALL remain separate from skill activation and SHALL NOT rewrite installed agent instructions or local customizations. The package SHALL ship only the loader and CLI-owned guidance format, without legacy full-text skill copies, obsolete config/API readers, implicit format fallbacks, aliases, conversion tooling, or compatibility shims; the explicit supported inline adapter SHALL not be treated as an obsolete reader. Consumer-project migration SHALL remain separately requested agent work rather than an installation side effect.

### Requirement: Independently installed adapters
Core SHALL not install native parsers, inline authoring, registry evidence or test-framework implementations. Official Markdown, Gherkin, inline and registry formats and runners SHALL be independently installable compiled ESM packages with declarations. Workspace installs SHALL use local packages without prior publication; core SHALL expose Format API 2 without depending on evidence storage adapters.

<!-- focused-spec:id=distribution.adapters.independent -->
#### Scenario: Core-only and adapter consumer installations
- **WHEN** a consumer installs the core alone and later installs selected format and runner packages
- **THEN** the first installation has no parser dependencies or fallback, and the selected packages enable native evidence execution independently of the source checkout

<!-- focused-spec:id=distribution.adapters.inline-registry -->
#### Scenario: Packed inline and registry consumers are independent
- **WHEN** disposable consumers install independently packed inline and registry adapters and select their documented formats
- **THEN** inline evidence executes with no registry and external native evidence executes through the explicit registry adapter, without source-checkout access or implicit core parser dependencies

### Requirement: Public installed runner contracts

Each official runner package SHALL make its selector syntax, supported framework and command options available as public package documentation, independently of source-checkout access. Consumers SHALL be able to select and execute real evidence from documented examples without inspecting plugin implementation.

<!-- focused-spec:id=distribution.runner.public-contracts -->
#### Scenario: Installed documentation supplies executable selectors
- **WHEN** a consumer installs independently packed official runner packages and chooses selectors from their public documentation
- **THEN** the documented selectors resolve and execute the selected real tests, and a controlled product regression makes that evidence fail rather than pass

### Requirement: Script-free prepared package packing
Packing an already-built core package with `npm pack --ignore-scripts` SHALL preserve and include its prepared runtime rather than rebuilding or restaging shared output. Ordinary core packing SHALL still build and stage current authored assets, and checkout installation SHALL retain its build lifecycle.

<!-- focused-spec:id=distribution.package.script-free-pack -->
#### Scenario: Packing prepared output does not replace it
- **WHEN** an already-built core package is packed with scripts disabled on the npm version bundled with the minimum supported Node.js release
- **THEN** the archive contains the prepared runtime, including a prepared module without a corresponding source file, and packing leaves that output intact

