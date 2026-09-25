## MODIFIED Requirements

### Requirement: Command-specific help
For `validate` and `run`, the CLI SHALL accept `<command> --help`, `<command> -h`, and `help <command>` as successful help requests. Each command help SHALL show its purpose, usage, every option supported by that command with its meaning, and practical examples. The `validate` help SHALL distinguish syntax-only, non-strict and strict validation, explain that planned evidence is allowed in any scope only when non-strict, and describe all-versus-selected scope behavior. The `run` help SHALL describe strict validation before execution, matching all-versus-selected scope behavior, that `--scenario` narrows both strict validation and execution to matching scenario instances, and the skip-success policy accurately. Help SHALL not offer options unsupported by that command.

#### Scenario: Validate help explains validation options
- **ID**: `cli.help.validate`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > explains validation modes and options in command help`
- **WHEN** a user requests `validate` help using any supported form
- **THEN** the CLI exits successfully with the supported validate options, their semantics and a usable example without listing run-only options

#### Scenario: Run help explains execution options
- **ID**: `cli.help.run`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > explains execution selection and skip policy in command help`
- **WHEN** a user requests `run` help using any supported form
- **THEN** the CLI exits successfully with the supported run options, their scenario validation/execution semantics and a usable example without listing validate-only options
