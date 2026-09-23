# CLI reference

The binary is `focused-spec`.

## Commands

```text
focused-spec validate [--root <path>] [--config <path>] [--change <name>] [--strict] [--syntax-only] [--json]
focused-spec run [--root <path>] [--config <path>] [--change <name>] [--scenario <id>] [--allow-skip] [--json]
```

`validate --syntax-only` checks document syntax and ownership without loading runners. Full `validate` loads runners and resolves evidence but does not execute tests. A successful full validation reports three counts:

- `scenarios`: every parsed scenario in the validation scope, including scenarios whose evidence is entirely planned;
- `plannedEvidence`: the number of `planned:` evidence rows;
- `targets`: unique resolved executable targets. Planned evidence is not resolved and does not contribute to this count.

Without `--change`, full validation covers current specifications plus all active changes. With `--change <name>`, it covers current specifications plus that selected change. The reported counts describe that complete scope.

The text form is `focused specifications are valid: <scenarios> scenarios, <plannedEvidence> planned evidence, <targets> unique targets`. The JSON form is:

```json
{
  "valid": true,
  "scenarios": 1,
  "plannedEvidence": 1,
  "targets": 0
}
```

No matching specifications is valid and reports zero for all three counts. `validate --syntax-only --json` instead reports `{ "valid": true, "mode": "syntax-only" }` because it does not resolve evidence.

For an active change, `validate --change <name>` permits `planned:` evidence and skips resolving those rows. `validate --change <name> --strict` and `run --change <name>` reject it: use them only after the planned tests exist and the references are concrete. `validate --change <name> --syntax-only` checks structure without loading runner modules.

`run` has separate validation and execution scopes:

- without `--change`, validation covers current specifications plus all active changes, while execution selects current specifications;
- with `--change <name>`, validation covers current specifications plus that selected change, while execution selects that change;
- `--scenario <id>` narrows only the execution selection. It does not narrow validation.

Text output begins with `validation scope:` and `execution selection:` lines that describe those choices. JSON output includes these stable objects:

```json
{
  "executionStarted": true,
  "validationScope": {
    "current": true,
    "changes": { "mode": "selected", "name": "add-search" }
  },
  "executionSelection": {
    "source": "change",
    "change": "add-search",
    "scenario": "search.results.empty"
  }
}
```

For a run without `--change`, `validationScope.changes` is `{ "mode": "all-active" }` and `executionSelection.source` is `"current"`; absent change and scenario selections are omitted. Completed run JSON also retains `success`, `scenarios`, and `targetCount`. A successful empty run has `executionStarted: false`, `scenarios: []`, and `targetCount: 0`: no test was executed.

If configuration, validation, or evidence resolution fails before tests run, text output says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, the same `validationScope` and `executionSelection`, and the machine-readable `violations` array. It does not include execution result fields, so it never claims that the selected scenario ran. A violation in an unselected scenario therefore remains attributable to the broader validation scope.

`--allow-skip` is valid only for `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed.

Exit non-zero on invalid configuration, unresolved evidence, failed execution, errors, or disallowed skips.

## Statuses

Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`. Only `PASS` is successful by default.

## Configuration
- The default config is `.focused-spec/config.yaml` under `--root`. A relative `--config` path is resolved from the selected project root. The configuration requires `version: 1`, a `specifications` source (`files` or `openspec`), and a `runners` object.
