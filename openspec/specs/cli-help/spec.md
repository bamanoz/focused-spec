# cli-help Specification

## Purpose

Discoverable CLI usage, command-specific options, and actionable argument-error guidance.

## Requirements

### Requirement: Discoverable top-level help
The CLI SHALL accept `focused-spec --help`, `focused-spec -h`, and `focused-spec help` as successful help requests. It SHALL show its purpose, usage, the available `validate`, `run`, `instructions`, and `init` commands with their distinct purposes, and a path to command-specific help on stdout, without running validation, execution, initialization, or guidance loading.

<!-- focused-spec:id=cli.help.overview -->
#### Scenario: Root help explains available commands
- **WHEN** a user requests root help using any supported form
- **THEN** the CLI exits successfully and distinguishes validation, evidence execution, package instructions, and explicit agent initialization, with detailed-help entrypoints and no implied execution or installation

### Requirement: Command-specific help
For `validate`, `run`, `instructions`, and `init`, the CLI SHALL accept `<command> --help`, `<command> -h`, and `help <command>` as successful help requests.

<!-- focused-spec:id=cli.help.validate -->
#### Scenario: Validate help explains validation options
- **WHEN** a user requests `validate` help using any supported form
- **THEN** the CLI exits successfully with the supported validate options, their semantics and a usable example without listing run-only options
- **AND** Validation and execution help SHALL explain native item bindings, exact evidence supplied by explicitly selected formats (including inline without a registry), and the distinction from host validity and unregistered coverage. Each command help SHALL show its purpose, usage, every option supported by that command with its meaning, and practical examples. The `validate` help SHALL distinguish syntax-only, non-strict and strict validation, explain that planned evidence is allowed in any scope only when non-strict, and describe all-versus-selected scope behavior. The `run` help SHALL describe strict validation before execution, matching all-versus-selected scope behavior, that `--scenario` narrows both strict validation and execution to matching scenario instances, and the skip-success policy accurately. The `instructions` help SHALL explain the protocol, topic, and JSON options, their defaults, offline configuration-independent operation, and incompatible-protocol failures. Help SHALL not offer options unsupported by that command.

<!-- focused-spec:id=cli.help.run -->
#### Scenario: Run help explains execution options
- **WHEN** a user requests `run` help using any supported form
- **THEN** the CLI exits successfully with the supported run options, their scenario validation/execution semantics and a usable example without listing validate-only options

<!-- focused-spec:id=cli.help.agent-guide -->
#### Scenario: Guidance help is available before configuration
- **WHEN** a user requests `instructions` help in an unconfigured project using any supported help form
- **THEN** the CLI successfully explains how to obtain version-compatible workflow and runner guidance without reading guidance assets or project configuration

### Requirement: Help independent of project state
Help SHALL be available without an existing project configuration or runner; explicit help SHALL not load or execute either. It SHALL remain human-readable text regardless of `--json` on a known command.

<!-- focused-spec:id=cli.help.no-config -->
#### Scenario: Help works outside a configured project
- **WHEN** a user invokes root or command help in a directory without focused-spec configuration
- **THEN** the CLI exits successfully with help text rather than a configuration violation or a JSON validation result

### Requirement: Invalid invocations remain errors
An absent or unknown command, an unknown option, a missing option value, or an unknown argument to `help` SHALL return a nonzero exit status with a concise stderr diagnostic and a pointer to appropriate help; invalid input SHALL NOT be treated as successful help. The retired `transition` command, its prepare/verify forms and its command-specific help SHALL be unknown commands, without compatibility aliases.

<!-- focused-spec:id=cli.help.invalid-invocation -->
#### Scenario: Invalid invocation points to help
- **WHEN** a user supplies an unknown command, an unknown option, a missing option value, an unknown help target, or a retired transition command/help invocation
- **THEN** the CLI fails with an actionable stderr diagnostic and the relevant help command, with no successful help or usable result on stdout

<!-- focused-spec:id=cli.help.duplicate-options -->
#### Scenario: Repeated options are invalid invocations
- **WHEN** run, validate or instructions receives a repeated value or boolean option
- **THEN** it returns nonzero with a help pointer and no usable stdout or execution; explicit help still takes precedence

### Requirement: Initialization help
Init help SHALL support `init --help`, `init -h` and `help init` without inspecting or changing project or home state. It SHALL describe the complete target catalog, aliases and shared roots, explicit selection and global MiniMax, native setup, preview/JSON/replacement, conflict preservation, interactive controls and installation-only success. Help SHALL remain human-readable with `--json`.

<!-- focused-spec:id=cli.help.init -->
#### Scenario: Init help is available before project setup
- **WHEN** a user requests init help through any supported form before setup, including JSON mode
- **THEN** help identifies the complete canonical catalog, alias, safety and explicit global boundary without reading or writing project/home integration state or claiming evidence readiness
- **AND** help explains the optional project path, `--tools`, `--dry-run`, `--json`, `--replace`, `--no-animation`, default conflict preservation, keyboard/review controls and target-appropriate invocation/setup hints

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

