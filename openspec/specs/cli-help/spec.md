# cli-help Specification

## Purpose

Discoverable CLI usage, command-specific options, and actionable argument-error guidance.

## Requirements

### Requirement: Discoverable top-level help
The CLI SHALL accept `focused-spec --help`, `focused-spec -h`, and `focused-spec help` as successful help requests. It SHALL show its purpose, usage, the available `validate` and `run` commands with their distinct purposes, and a path to command-specific help on stdout, without running validation or execution.

#### Scenario: Root help explains available commands
- **ID**: `cli.help.overview`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > shows a successful command overview for root help forms`
- **WHEN** a user requests root help using any supported form
- **THEN** the CLI exits successfully and shows the two commands and how to inspect their detailed help without claiming validation or execution

### Requirement: Command-specific help
For `validate` and `run`, the CLI SHALL accept `<command> --help`, `<command> -h`, and `help <command>` as successful help requests. Each command help SHALL show its purpose, usage, every option supported by that command with its meaning, and practical examples. The `validate` help SHALL distinguish syntax-only, non-strict and strict validation, explain that planned evidence is allowed in any scope only when non-strict, and describe all-versus-selected scope behavior. The `run` help SHALL describe strict validation before execution, matching all-versus-selected scope behavior, that `--scenario` narrows both strict validation and execution to matching scenario instances, and the skip-success policy accurately. Help SHALL not offer options unsupported by that command.

#### Scenario: Validate help explains validation options
- **ID**: `cli.help.validate`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > explains validation modes and options in command help`
- **WHEN** a user requests `validate` help using any supported form
- **THEN** the CLI exits successfully with the supported validate options, their semantics and a usable example without listing run-only options

#### Scenario: Run help explains execution options
- **ID**: `cli.help.run`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > explains execution selection and skip policy in command help`
- **WHEN** a user requests `run` help using any supported form
- **THEN** the CLI exits successfully with the supported run options, their scenario validation/execution semantics and a usable example without listing validate-only options

### Requirement: Help independent of project state
Help SHALL be available without an existing project configuration or runner; explicit help SHALL not load or execute either. It SHALL remain human-readable text regardless of `--json` on a known command.

#### Scenario: Help works outside a configured project
- **ID**: `cli.help.no-config`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > shows help without loading configuration or runners`
- **WHEN** a user invokes root or command help in a directory without focused-spec configuration
- **THEN** the CLI exits successfully with help text rather than a configuration violation or a JSON validation result

### Requirement: Invalid invocations remain errors
An absent or unknown command, an unknown option, a missing option value, or an unknown argument to `help` SHALL return a nonzero exit status with a concise stderr diagnostic and a pointer to appropriate help; invalid input SHALL NOT be treated as successful help.

#### Scenario: Invalid invocation points to help
- **ID**: `cli.help.invalid-invocation`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > directs invalid invocations to help without succeeding`
- **WHEN** a user supplies an unknown command, an unknown option, a missing option value, or an unknown help target
- **THEN** the CLI fails with an actionable diagnostic and the relevant help command rather than claiming successful help
