# distribution Specification

## Purpose

Consumer installation, CLI and type exports, and independent agent skill setup.

## Requirements

### Requirement: Node package distribution
The package SHALL install in Node.js 24+ consumers with a `focused-spec` CLI, compiled runtime and public `focused-spec` and `focused-spec/runner` entry points. Building a Git checkout or npm pack SHALL produce the same runnable package contents.

#### Scenario: Packed CLI runs in a consumer project
- **ID**: `distribution.package.cli`
- **EVIDENCE**: `vitest::test/package.spec.ts::package distribution > installs and executes the packed CLI from a consumer project`
- **WHEN** a consumer installs the packed package as a development dependency
- **THEN** its installed CLI can validate a configured scenario without reading this repository's source tree

#### Scenario: Runner types are available from the declared subpath
- **ID**: `distribution.package.runner-api`
- **EVIDENCE**: `vitest::test/package.spec.ts::package distribution > typechecks a consumer plugin against focused-spec runner`
- **WHEN** a consumer imports `RunnerPlugin` as a type from `focused-spec/runner`
- **THEN** the plugin typechecks against the published runner contract without internal source imports

### Requirement: Skill installation is separate
Installing the CLI SHALL NOT silently install an agent skill or manufacture a framework runner. The focused-spec skill SHALL be installable separately for supported agents.

#### Scenario: CLI installation has no agent side effects
- **ID**: `distribution.skill.separate-install`
- **EVIDENCE**: `vitest::test/package.spec.ts::package distribution > installs the CLI without creating an agent skill or runner`
- **WHEN** a consumer installs only the npm package
- **THEN** no agent skill or project-specific runner is created in the consumer project
