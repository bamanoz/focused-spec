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

<!-- focused-spec:id=distribution.package.retired-assets -->
#### Scenario: Rebuild removes retired generated assets
- **WHEN** a generated package asset no longer exists in its authored owner before repeated staging
- **THEN** the rebuilt package omits the retired asset and retains current authored contents

<!-- focused-spec:id=distribution.package.retired-runtime -->
#### Scenario: Rebuild removes retired runtime outputs
- **WHEN** an authored runtime module is removed before the next package build
- **THEN** the resulting package no longer contains its retired compiled runtime or declaration
