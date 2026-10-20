# Spec Delta

## ADDED Requirements

### Requirement: Offline executable identity
The CLI SHALL provide `--version`, `-V`, and `version [--json]` without reading project configuration, importing plugins, accessing the network or writing files. Identity SHALL describe the invoked installation, not a package selected from the consumer project.

<!-- focused-spec:id=cli.version.offline -->
#### Scenario: Invoked package reports its own identity offline
- **WHEN** a packed consumer requests version discovery from an unconfigured or malformed-config project
- **THEN** text reports the invoked package name/version and JSON reports its manifest name/version, canonical executable path, Node runtime and guidance/configuration/format/runner contract versions
- **AND** unsupported, duplicate or extra version arguments fail instead of being ignored

### Requirement: JSON invocation and uncaught failure transport
With an actual `--json` option, invalid invocations and uncaught command failures SHALL exit 1 with empty stdout and exactly one stderr JSON object containing `error.code` and `error.message`. Invalid arguments SHALL use `invalid_arguments` and include `error.help`; other thrown failures SHALL use `command_failed`. Existing command-specific business-result shapes SHALL remain unchanged.

<!-- focused-spec:id=cli.errors.json -->
#### Scenario: Invalid arguments use one machine-readable error
- **WHEN** a consumer requests JSON with unknown, missing, conflicting or repeated options, an unknown command, or invalid instructions/init arguments
- **THEN** stdout is empty and stderr contains one actionable structured error and the appropriate help command
- **AND** explicit help remains successful human-readable text and performs no project work

<!-- focused-spec:id=cli.errors.runtime -->
#### Scenario: Uncaught lookup failure remains machine-readable
- **WHEN** a JSON plugin documentation request cannot obtain the selected installed document
- **THEN** it exits 1 with empty stdout and one `command_failed` stderr object retaining the actionable cause

<!-- focused-spec:id=cli.errors.opaque-values -->
#### Scenario: Opaque values do not enable JSON transport
- **WHEN** `--json` is consumed as a scenario ID or follows the show positional delimiter rather than being an option
- **THEN** it remains the exact ID and does not switch error transport to JSON
- **AND** a rejected flag-looking non-ID option value does not hide a subsequent actual `--json` option

### Requirement: Additional flat command help
Root help SHALL discover `version`, `list` and `show` alongside existing commands. These commands SHALL support `--help`, `-h` and `help <command>` without configuration or plugins. Validate help SHALL include scenario selection; inspection help SHALL distinguish structural inspection from resolution, execution and native coverage.

<!-- focused-spec:id=cli.help.discovery-inspection -->
#### Scenario: New commands and selection are discoverable offline
- **WHEN** the consumer requests root, version, list, show or validate help before project setup
- **THEN** help exposes the supported syntax and options without inspecting project state and without implying test execution or full native coverage
