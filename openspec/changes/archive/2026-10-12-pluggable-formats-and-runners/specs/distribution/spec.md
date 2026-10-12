# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Independently installed adapters
The core SHALL not install Markdown, Gherkin or test framework implementations. Official formats and runners SHALL be separately installable packages with compiled ESM runtime and type declarations. Repository workspace installation SHALL use local packages without requiring their prior registry publication.

<!-- focused-spec:id=distribution.adapters.independent -->
#### Scenario: Core-only and adapter consumer installations
- **WHEN** a consumer installs the core alone and later installs selected format and runner packages
- **THEN** the first installation has no parser dependencies or fallback, and the selected packages enable native evidence execution independently of the source checkout
