# CLI reference

The binary is `focused-spec`.

## Commands

```text
focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--strict] [--syntax-only] [--json] [--timings]
focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--json] [--timings]
```

Scope names are path-safe single fragments. The CLI preserves the selected name exactly; it never treats it as a glob or path.

## Help and argument errors

The root overview is available as `focused-spec --help`, `focused-spec -h`, or `focused-spec help`. It describes both commands and points to detailed help. Use `focused-spec validate --help`, `focused-spec validate -h`, or `focused-spec help validate` for validation options; use the corresponding `run` forms for execution options. Each command's help includes its purpose, supported options, defaults, selection rules, and examples.

Explicit help writes text to stdout and exits zero without reading `.focused-spec/config.yaml` or loading runners; it works outside a configured project. For a known command, help takes precedence over other options, including `--json`: `focused-spec run --json --help` prints text, not a JSON result. An unknown command does not become valid by adding `--help`.

No command, an unknown command or option, a missing option value, or an unknown `help` target exits nonzero with a diagnostic on stderr and a pointer to `focused-spec --help` or the relevant `<command> --help`. Other validation and execution output contracts below are unchanged.

## Validation

`validate --syntax-only` checks document syntax and ownership without loading runners. Full `validate` loads runners and resolves concrete evidence but does not execute tests. A successful full validation reports:

- `scenarios`: every parsed scenario in the validation scope, including scenarios whose evidence is entirely planned;
- `plannedEvidence`: the number of `planned:` evidence rows;
- `targets`: unique resolved executable targets. Planned evidence is not resolved and does not contribute to this count.

Without `--scope`, validation covers every discovered scope. With `--scope <name>`, it covers only that scope; unrelated scopes are not otherwise validated or resolved, though repository ownership checks may inspect their scenario IDs and revision links without resolving evidence. A requested scope with no matching documents is an error. Any discovered scope with documents but no focused scenarios is also an error. A project whose layouts match no documents is valid and reports zero counts when no scope is selected.

Validation text starts with `validation scope: all discovered scopes` or `validation scope: selected scope <name>`, followed by the success summary or violations. Successful full-validation JSON carries that same context:

```json
{
  "valid": true,
  "validationScope": {
    "scopes": { "mode": "all" }
  },
  "scenarios": 1,
  "plannedEvidence": 1,
  "targets": 0
}
```

`validate --syntax-only --json` omits evidence counts but retains the context because it checks the same document set:

```json
{
  "valid": true,
  "mode": "syntax-only",
  "validationScope": {
    "scopes": { "mode": "selected", "name": "add-search" }
  }
}
```

Validation failures report `valid: false`, the same `validationScope`, and a machine-readable `violations` array. They do not report successful counts.

Non-strict validation permits `planned:` evidence in every scope and skips resolving those rows. `--strict` rejects all planned evidence. Use syntax-only or non-strict validation while planning any scope; use strict validation only after its exact tests exist.

## Execution and result context

`run` performs strict validation before executing anything. Validation and execution use the same scope selection:

- without `--scope`, both select all discovered scopes;
- with `--scope <name>`, both select only that scope;
- `run --scenario <id>` narrows strict validation, evidence resolution, and execution to occurrences of that ID in the selected scope(s). With no `--scope`, matching revisions across scopes are all selected. Without `--scenario`, full selected-scope validation and execution remain unchanged.

Strict `run` resolves concrete evidence for exactly its validation selection once, then executes those already-resolved targets. Malformed, planned, or unresolved evidence in the selected scenario prevents execution; evidence errors in unrelated scenarios do not block `run --scenario`. Plain `validate`, including `validate --strict`, still checks all scenarios in its selected scope(s) but never executes tests.

Text output begins with exactly one of these validation lines:

```text
validation scope: all discovered scopes
validation scope: selected scope add-search
validation scope: selected scope add-search, scenario search.results.empty
```

It is followed by the corresponding execution line; a selected scenario is appended when present:

```text
execution selection: all discovered scopes
execution selection: selected scope add-search, scenario search.results.empty
```

JSON output includes these stable neutral context objects:

```json
{
  "executionStarted": true,
  "validationScope": {
    "scopes": { "mode": "selected", "name": "add-search" },
    "scenario": "search.results.empty"
  },
  "executionSelection": {
    "scopes": { "mode": "selected", "name": "add-search" },
    "scenario": "search.results.empty"
  }
}
```

For a run without `--scope`, both context objects contain `scopes: { "mode": "all" }`; `--scenario` adds the same `scenario` ID to both. When `--scenario` is absent, both scenario properties are omitted. Every scenario result includes its `scope`. In multi-scope text output, scenario rows use `PASS [<scope>] <scenario-id>` (and the corresponding non-pass status); selected-scope rows omit the bracketed prefix. Completed run JSON also retains `success`, `scenarios`, and `targetCount`. A successful run with no discovered scopes has `executionStarted: false`, `scenarios: []`, and `targetCount: 0`: no test was executed and no scenario is reported as passing.

If configuration, discovery, selected-scenario validation, or evidence resolution fails before tests run, text output says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, the actual `validationScope` and `executionSelection`, and the machine-readable `violations` array. It omits execution result fields, so it never claims that the selection ran. An explicitly missing or empty selected scope, or a scenario ID absent from the selected scope(s), follows this failure contract. Scope-wide validation is not implied by a successful scenario-only run.

`--allow-skip` is valid only for `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed. Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`; only `PASS` is successful by default.

The CLI exits nonzero on invalid configuration, discovery violations, unresolved evidence, failed execution, errors, or disallowed skips.

## Timing output

`--timings` adds a `timings` object to JSON or a `timings:` line to text output. Fields are elapsed milliseconds: `validationMs` covers document discovery and structural validation, `resolutionMs` covers runner resolution, `executionMs` covers execution (including partition planning and scheduling wait), and `totalMs` covers the command from argument parsing until output construction begins. A phase appears only if reached; validation failures retain timings for reached phases. The execution phase is absent when execution does not start. These phases do not cover all of `totalMs`, and concurrent activities can overlap; do not sum them to infer wall time. Without `--timings`, result fields and text remain unchanged.

## Execution concurrency

The optional `execution.maxConcurrentGroups` project setting is a positive integer, defaulting to 1. Above 1, the core may overlap only resource-compatible groups explicitly returned by a runner's optional `partition` method; legacy and explicitly exclusive groups remain exclusive. It does not configure the underlying framework worker count and it does not coordinate other CLI processes. See the [runner API](runner-api.md) for group validation and result semantics.

## Configuration

The default config is `.focused-spec/config.yaml` under `--root`. A relative `--config` path is resolved from the selected project root. Configuration requires `version: 2`, a nonempty `specifications.documents` list, and a `runners` object. The [configuration guide](../guides/configuration.md) is the normative layout and migration reference.

## Uniform-scope result migration

The uniform model is a clean result-context cutover. No aliases are emitted for old baseline/current/change fields, and no scope name receives privileged semantics. In consumers of JSON:

- replace current/change/baseline validation context with `validationScope.scopes: { "mode": "all" }` or `{ "mode": "selected", "name": <name> }`;
- replace source-specific execution context with `executionSelection.scopes` using the same all-or-selected shape;
- retain an optional `executionSelection.scenario` only when `--scenario` was supplied;
- read each scenario result's `scope` when correlating repeated IDs.

Configuration remains version 2. The older `--change <name>` option still has no compatibility alias; use `--scope <name>`. Project runner plugins require no change; `partition` remains an optional addition to the `apiVersion: 1` runner API.
