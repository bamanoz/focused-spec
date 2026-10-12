# Spec Delta

## MODIFIED Requirements

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
