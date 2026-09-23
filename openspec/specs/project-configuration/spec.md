# project-configuration Specification

## Purpose

Versioned runner configuration and specification source discovery.

## Requirements

### Requirement: Project configuration
The CLI SHALL load a version-1 `.focused-spec/config.yaml` from the selected project root unless an explicit configuration path is supplied. It SHALL reject invalid source settings and runner definitions at the configuration boundary.

#### Scenario: Missing or invalid configuration
- **ID**: `config.document.invalid`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports missing malformed and unsupported configuration`
- **WHEN** a project has no readable version-1 configuration with a specifications source and runners map
- **THEN** validation exits nonzero with an actionable configuration violation

#### Scenario: Runner timeout exceeds the host timer range
- **ID**: `config.runner.timeout-bound`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects runner timeouts that overflow the host timer`
- **WHEN** a runner timeout exceeds 2147482647 milliseconds
- **THEN** configuration is rejected before any overflowing host timer is created

#### Scenario: Unsafe or non-JSON runner configuration
- **ID**: `config.runner.invalid-options`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid runner paths and non JSON options`
- **WHEN** a runner module path escapes the project root or runner options are not JSON-compatible
- **THEN** validation reports a configuration or runner-path error without loading the module

### Requirement: Specification sources
The CLI SHALL discover file-backed scenarios by configured Markdown globs or OpenSpec current and active change `spec.md` paths under the configured root.

#### Scenario: File globs match no specifications
- **ID**: `config.source.empty-files`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** the configured file-source globs match no Markdown specifications
- **THEN** validation reports zero scenarios, planned evidence, and targets without treating absence as an error

#### Scenario: OpenSpec current and active changes are discovered
- **ID**: `config.source.openspec-discovery`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** OpenSpec current specifications and an active change each contain scenarios
- **THEN** full validation includes both sources in its reported scenario count
