## Why

`focused-spec --help` currently exits with an error and prints only two usage lines; `focused-spec validate --help` is rejected as an unknown argument. A user cannot discover what the options mean, how validation differs from execution, or how to get command-specific guidance without leaving the terminal. OpenSpec demonstrates a useful hierarchy: a short command overview and detailed per-command help.

## What Changes

- Provide successful top-level help (`--help`, `-h`, and `help`) that describes the CLI, lists `validate` and `run`, and points to command-specific help.
- Provide successful `validate --help` and `run --help` (also `-h` and `help <command>`) with command purpose, usage, each supported option and its meaning, and actionable examples. Explain strict validation, scope selection, planned evidence, and run's skip policy without misleading users about execution.
- Make help independent of project configuration and runners. Keep invalid commands/options nonzero with a concise pointer to relevant help; do not change validation/execution behavior or JSON results.
- Document the help contract and verify it through actual CLI invocations.

## Capabilities

### New Capabilities

- `cli-help`: Discoverable top-level and command-specific CLI usage and error guidance.

### Modified Capabilities

None.

## Impact

- `src/cli.ts` argument dispatch and help rendering; `test/cli.spec.ts` CLI behavior checks.
- `docs/reference/cli.md` normative help contract and the documentation map if a new baseline spec page is later added.
- No new runtime dependency, runner API change, or altered validation/execution selection.
