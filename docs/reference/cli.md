# CLI reference

The binary is `focused-spec`.

## Commands

```text
focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--strict] [--syntax-only] [--json]
focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--json]
```

Scope names are path-safe single fragments. The CLI preserves the selected name exactly; it never treats it as a glob or path.

## Validation

`validate --syntax-only` checks document syntax and ownership without loading runners. Full `validate` loads runners and resolves concrete evidence but does not execute tests. A successful full validation reports:

- `scenarios`: every parsed scenario in the validation scope, including scenarios whose evidence is entirely planned;
- `plannedEvidence`: the number of `planned:` evidence rows;
- `targets`: unique resolved executable targets. Planned evidence is not resolved and does not contribute to this count.

Without `--scope`, validation covers the baseline plus every discovered named scope. With `--scope <name>`, it covers the baseline plus only that scope; unrelated scopes are neither discovered nor validated. A requested scope with no matching documents is an error. Any discovered named scope with documents but no focused scenarios is also an error. A legitimately empty baseline is valid and reports zero counts when no named scopes are discovered.

Validation text starts with `validation scope: baseline specifications and all named scopes` or `validation scope: baseline specifications and selected scope <name>`, followed by the success summary or violations. Successful full-validation JSON carries that same context:

```json
{
  "valid": true,
  "validationScope": {
    "baseline": true,
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
    "baseline": true,
    "scopes": { "mode": "selected", "name": "add-search" }
  }
}
```

Validation failures report `valid: false`, the same `validationScope`, and a machine-readable `violations` array. They do not report successful counts.

Non-strict validation permits `planned:` evidence only in named scopes and skips resolving those rows. Baseline evidence must always be concrete. `--strict` rejects all planned evidence. Use syntax-only or non-strict validation while planning a named scope; use strict validation only after its exact tests exist.

## Execution and result context

`run` performs strict validation before executing anything. Validation and execution have separate selections:

- without `--scope`, validation covers the baseline plus all discovered named scopes, while execution selects the baseline;
- with `--scope <name>`, validation covers the baseline plus only that scope, while execution selects that scope;
- `--scenario <id>` narrows only the execution selection. It does not narrow validation.

Text output begins with exactly one of these validation lines:

```text
validation scope: baseline specifications and all named scopes
validation scope: baseline specifications and selected scope add-search
```

It is followed by the corresponding execution line; a selected scenario is appended when present:

```text
execution selection: baseline specifications
execution selection: scope add-search, scenario search.results.empty
```

JSON output includes these stable neutral context objects:

```json
{
  "executionStarted": true,
  "validationScope": {
    "baseline": true,
    "scopes": { "mode": "selected", "name": "add-search" }
  },
  "executionSelection": {
    "source": "scope",
    "scope": "add-search",
    "scenario": "search.results.empty"
  }
}
```

For a run without `--scope`, `validationScope.scopes` is `{ "mode": "all" }` and `executionSelection.source` is `"baseline"`; absent `scope` and `scenario` properties are omitted. Completed run JSON also retains `success`, `scenarios`, and `targetCount`. A successful empty baseline run has `executionStarted: false`, `scenarios: []`, and `targetCount: 0`: no test was executed and no scenario is reported as passing.

If configuration, discovery, validation, or evidence resolution fails before tests run, text output says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, the same `validationScope` and `executionSelection`, and the machine-readable `violations` array. It omits execution result fields, so it never claims that the selection ran. An explicitly missing or empty selected scope follows this failure contract.

`--allow-skip` is valid only for `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed. Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`; only `PASS` is successful by default.

The CLI exits nonzero on invalid configuration, discovery violations, unresolved evidence, failed execution, errors, or disallowed skips.

## Configuration

The default config is `.focused-spec/config.yaml` under `--root`. A relative `--config` path is resolved from the selected project root. Configuration requires `version: 2`, a nonempty `specifications.documents` list, and a `runners` object. The [configuration guide](../guides/configuration.md) is the normative layout and migration reference.

## Version-1 CLI and result migration

The old `--change <name>` option has no compatibility alias; use `--scope <name>`. In consumers of run JSON:

- replace `validationScope.current: true` with `validationScope.baseline: true`;
- replace `validationScope.changes: { "mode": "all-active" }` with `validationScope.scopes: { "mode": "all" }`;
- replace selected `validationScope.changes` with `validationScope.scopes: { "mode": "selected", "name": <name> }`;
- replace `executionSelection.source: "current"` with `"baseline"`;
- replace `executionSelection.source: "change"` with `"scope"` and rename its `change` property to `scope`.

The runner plugin API is unchanged.
