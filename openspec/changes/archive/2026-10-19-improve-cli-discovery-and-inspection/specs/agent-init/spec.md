# Spec Delta

## MODIFIED Requirements

### Requirement: Observable initialization result
Init SHALL exit 0 for successful install/no-op/preview, otherwise 1. Human output SHALL distinguish installation from activation/evidence and give native hints. After valid invocation, JSON SHALL retain `{ root, tools, dryRun, files, errors }` with truthful actions/errors and only completed writes marked applied. Invalid invocation SHALL instead use the shared CLI error transport before installation starts.

<!-- focused-spec:id=init.output.json -->
#### Scenario: Machine-readable output distinguishes writes and conflicts
- **WHEN** a scripted consumer installs, previews, or encounters a destination conflict using `--json` and explicit targets
- **THEN** stdout contains one parseable result document with the actual actions, applied writes and errors, and the exit status distinguishes success from failure without claiming evidence execution
- **AND** files use `{ path, action, applied }`, actions are `install`, `unchanged`, `replace` or `conflict`, and errors use `{ path?, message }`; only completed writes have `applied: true`
- **AND** root remains canonical or null, tools remain distinct canonical IDs, dryRun reports preview, project paths remain relative and MiniMax paths absolute; completed writes remain reported after later I/O failure

<!-- focused-spec:id=init.output.invalid-invocation -->
#### Scenario: Invalid invocation is not an installation report
- **WHEN** JSON initialization receives invalid arguments or omits required noninteractive target selection
- **THEN** it exits 1 with empty stdout and one `invalid_arguments` stderr object with init help, before any integration write
