# Spec Delta

## MODIFIED Requirements

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
