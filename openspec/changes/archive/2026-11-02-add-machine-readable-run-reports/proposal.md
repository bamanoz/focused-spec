# Proposal

## Why

`focused-spec run --json` already provides a detailed, stable result for programmatic consumers, but CI systems commonly expect a standard test-report file and a reusable GitHub Action. Consumers currently have to translate focused-spec outcomes themselves, risking status loss or inconsistent handling of skips, preflight failures, and native scenario identity.

## What Changes

- Add an opt-in JUnit XML report file to `focused-spec run`, generated from the same execution result as text and JSON output without rerunning evidence.
- Preserve current `--json` output as the machine-readable detailed contract; do not add a redundant JSON-file format or SARIF mapping without meaningful static diagnostic rules and locations.
- Define JUnit identity, status mapping, diagnostics, XML escaping, output-path behavior, and behavior when strict preflight prevents execution or no evidence runs.
- Add a composite GitHub Action that invokes the installed CLI, exposes report path and command outcome, and documents an unprivileged workflow for untrusted pull requests.
- Keep host specification lifecycle integrations out of scope; no OpenSpec or Spec Kit integration is added.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `scenario-execution`: Add optional JUnit report output derived from run results, retaining actual execution status and native scenario context.
- `cli-help`: Document the run report option and its behavior.

## Impact

CLI argument parsing/rendering and CLI help/reference specs, a reusable GitHub Action, and relevant CLI/action documentation. Existing JSON and human output remain supported. No SDK API, runner protocol, configuration schema, SARIF support, or host SDD integration changes are proposed.