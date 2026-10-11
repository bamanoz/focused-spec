# cli-help Specification

## Purpose

Discoverable CLI usage, command-specific options, and actionable argument-error guidance.

## Requirements

### Requirement: Discoverable top-level help
The CLI SHALL accept `focused-spec --help`, `focused-spec -h`, and `focused-spec help` as successful help requests. It SHALL show its purpose, usage, the available `validate` and `run` commands with their distinct purposes, and a path to command-specific help on stdout, without running validation or execution.

<!-- focused-spec:id=cli.help.overview -->
#### Scenario: Root help explains available commands
- **WHEN** a user requests root help using any supported form
- **THEN** the CLI exits successfully and shows the two commands and how to inspect their detailed help without claiming validation or execution

### Requirement: Command-specific help
For `validate` and `run`, the CLI SHALL accept `<command> --help`, `<command> -h`, and `help <command>` as successful help requests. Help SHALL explain native item bindings, the required evidence registry, and the distinction from host validity and unregistered coverage. Each command help SHALL show its purpose, usage, every option supported by that command with its meaning, and practical examples. The `validate` help SHALL distinguish syntax-only, non-strict and strict validation, explain that planned evidence is allowed in any scope only when non-strict, and describe all-versus-selected scope behavior. The `run` help SHALL describe strict validation before execution, matching all-versus-selected scope behavior, that `--scenario` narrows both strict validation and execution to matching scenario instances, and the skip-success policy accurately. Help SHALL not offer options unsupported by that command.

<!-- focused-spec:id=cli.help.validate -->
#### Scenario: Validate help explains validation options
- **WHEN** a user requests `validate` help using any supported form
- **THEN** the CLI exits successfully with the supported validate options, their semantics and a usable example without listing run-only options

<!-- focused-spec:id=cli.help.run -->
#### Scenario: Run help explains execution options
- **WHEN** a user requests `run` help using any supported form
- **THEN** the CLI exits successfully with the supported run options, their scenario validation/execution semantics and a usable example without listing validate-only options

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
