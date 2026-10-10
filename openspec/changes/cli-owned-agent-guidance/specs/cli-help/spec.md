## MODIFIED Requirements

### Requirement: Discoverable top-level help
The CLI SHALL accept `focused-spec --help`, `focused-spec -h`, and `focused-spec help` as successful help requests. It SHALL show its purpose, usage, the available `validate`, `run`, and `agent-guide` commands with their distinct purposes, and a path to command-specific help on stdout, without running validation, execution, or guidance delivery.

<!-- focused-spec:id=cli.help.overview -->
#### Scenario: Root help explains available commands
- **WHEN** a user requests root help using any supported form
- **THEN** the CLI exits successfully and explains validation, evidence execution, and package-owned guidance and how to inspect their detailed help without claiming any was performed

### Requirement: Command-specific help
For `validate`, `run`, and `agent-guide`, the CLI SHALL accept `<command> --help`, `<command> -h`, and `help <command>` as successful help requests. Validation and execution help SHALL explain native item bindings, the required evidence registry, and the distinction from host validity and unregistered coverage. Each command help SHALL show its purpose, usage, every option supported by that command with its meaning, and practical examples. The `validate` help SHALL distinguish syntax-only, non-strict and strict validation, explain that planned evidence is allowed in any scope only when non-strict, and describe all-versus-selected scope behavior. The `run` help SHALL describe strict validation before execution, matching all-versus-selected scope behavior, that `--scenario` narrows both strict validation and execution to matching scenario instances, and the skip-success policy accurately. The `agent-guide` help SHALL explain the protocol, topic, and JSON options, their defaults, offline configuration-independent operation, and incompatible-protocol failures. Help SHALL not offer options unsupported by that command.

<!-- focused-spec:id=cli.help.validate -->
#### Scenario: Validate help explains validation options
- **WHEN** a user requests `validate` help using any supported form
- **THEN** the CLI exits successfully with the supported validate options, their semantics and a usable example without listing run-only options

<!-- focused-spec:id=cli.help.run -->
#### Scenario: Run help explains execution options
- **WHEN** a user requests `run` help using any supported form
- **THEN** the CLI exits successfully with the supported run options, their scenario validation/execution semantics and a usable example without listing validate-only options

<!-- focused-spec:id=cli.help.agent-guide -->
#### Scenario: Guidance help is available before configuration
- **WHEN** a user requests `agent-guide` help in an unconfigured project using any supported help form
- **THEN** the CLI successfully explains how to obtain version-compatible workflow and runner guidance without reading guidance assets or project configuration
