# CLI reference

The binary is `focused-spec`.

## Commands

```text
focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--strict] [--syntax-only] [--json] [--timings]
focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--json] [--timings]
focused-spec instructions [--protocol <version>] [--topic workflow|runners] [--json]
```

Scope names are path-safe single fragments. The CLI preserves the selected name exactly; it never treats it as a glob or path.

## Help and argument errors

Use `focused-spec --help`, `<command> --help`, and `focused-spec help <command>` for the installed command's options, defaults, selection rules, and examples. Explicit help exits zero without reading project configuration, the evidence registry, runner modules, or guidance assets. For a known command, help takes precedence over other options, including `--json`. The retired `transition` command and its help forms are unknown commands, not aliases.

No command, an unknown command or option, an extra positional argument, a duplicate option, a missing value, or an unknown `help` target exits nonzero with a diagnostic and the relevant help pointer.

## Package-owned agent guidance

`instructions` reads the invoked package's authoritative workflow (default topic) or complete runner guidance (`--topic runners`). It works offline before project setup, creates no project or agent files, and does not perform validation or evidence execution. Invoke the consuming project's explicit installed CLI, not an unverified global binary or a downloading `npx` invocation.

The previous `agent-guide` command is not an alias. Refresh the installed loader when moving to `instructions`; protocol 1, topic names and response fields are unchanged.

Loader protocol defaults to 1; it is independent of package versions, configuration version 3, and runner API version 1. The loader requests it explicitly. Protocol-1 JSON is:

```json
{
  "protocolVersion": 1,
  "package": { "name": "focused-spec", "version": "<installed version>" },
  "topic": "workflow",
  "content": "<complete Markdown guidance>"
}
```

Text output identifies the installed package version, protocol, and topic before the Markdown. An unsupported protocol, invalid option/topic, missing value, or incomplete package exits nonzero with stderr diagnostics and no usable guidance on stdout. An explicit unsupported protocol is never silently replaced with the default. No legacy full-text skill or alternate installation is used as a fallback.

```sh
./node_modules/.bin/focused-spec instructions --protocol 1 --json
./node_modules/.bin/focused-spec instructions --protocol 1 --topic runners --json
```

## Validation

Validation reads version-3 configuration, its configured evidence-registry files (default `.focused-spec/evidence.yaml`), and selected native `.md` or `.feature` documents. It binds every selected registry entry to exactly one native item and rejects marked items without entries. Missing, detached, duplicate, conflicting, unbound, or ambiguous identities are violations.

`validate --syntax-only` checks configuration, registry syntax, native document syntax, scope-local identity, and binding without loading runner modules. Full `validate` additionally loads runners and resolves concrete evidence, but never executes tests. A successful full-validation JSON result retains:

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

- `scenarios` is the number of bound registry entries in the validation selection;
- `plannedEvidence` is the number of selected `planned:` references;
- `targets` is the number of unique resolved executable targets. Planned evidence is not resolved and does not contribute.

Unmarked native content is not focused coverage and is not reported as an arbitrary native-item count. Validation failures return `valid: false`, the actual `validationScope`, and machine-readable `violations`; successful counts are omitted.

Non-strict validation permits planned evidence and skips its resolution. `--strict` rejects it. Use syntax-only or non-strict validation while planning, and strict validation after every selected target exists.

Without `--scope`, validation selects every discovered scope and registry entry. With `--scope <name>`, it selects only that scope and ignores failures elsewhere. A missing selected scope is an error. An all-scope project with a present registry containing `scopes: {}` and no discovered documents is valid and reports zero counts; a missing registry is always an error.

## Execution and result context

`run` performs strict validation before executing anything:

- without `--scope`, binding, resolution, and execution select all scopes;
- with `--scope <name>`, they select only that scope;
- `run --scenario <id>` selects only matching `(scope, ID)` entries, including their native bindings and evidence. Unrelated entry, binding, and evidence failures do not prevent that selected run.

With no `--scope`, a repeated ID selects each matching scope independently and uses each entry's evidence. Shared resolved targets remain deduplicated; same-ID reuse does not merge scenario results or inherit evidence. Plain `validate`, including `validate --strict`, still checks its complete selected scope set and never executes tests.

Text output begins with validation and execution context lines such as:

```text
validation scope: all discovered scopes
execution selection: all discovered scopes
```

or:

```text
validation scope: selected scope add-search, scenario search.results.empty
execution selection: selected scope add-search, scenario search.results.empty
```

Completed JSON retains `executionStarted`, `validationScope`, `executionSelection`, `success`, the `scenarios` result array, and `targetCount`. Both context objects use `scopes: { "mode": "all" }` for all-scope execution or `scopes: { "mode": "selected", "name": "<scope>" }` for one scope. When `--scenario` is present, both also contain that scenario ID.

Every scenario result includes its `scope`. Multi-scope text rows include `[<scope>]`; selected-scope rows omit that prefix. No execution output includes an unverified native-item count.

If configuration, registry parsing, native binding, selected evidence resolution, or strict validation fails before execution, text says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, actual selection context, and `violations`, and omits execution result fields. A scenario ID absent from the selected scope or scopes follows this failure contract. Scope-wide validation is not implied by a successful scenario-only run.

`--allow-skip` applies only to `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed. Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`; only `PASS` succeeds by default. The CLI exits nonzero on invalid configuration, missing or invalid registry, discovery or binding violations, unresolved evidence, failed execution, errors, or disallowed skips.

## Timing output

`--timings` adds a `timings` object to JSON or a `timings:` line to text. `validationMs` covers registry loading, document discovery, parsing, and binding; `resolutionMs` covers runner resolution; `executionMs` covers execution and scheduling; `totalMs` covers the command until output construction begins. A phase appears only when reached. Concurrent activities may overlap, so phase values are not additive.

## Execution concurrency

`execution.maxConcurrentGroups` is a positive integer and defaults to 1. Above 1, core overlaps only resource-compatible groups returned by a runner's optional `partition` method. Runners without partition support and explicitly exclusive groups remain exclusive. This setting does not configure framework worker counts or coordinate other CLI processes. See the [runner API](runner-api.md).

## Configuration and version-2 migration

The default config is `.focused-spec/config.yaml` under `--root`; a relative `--config` path resolves from that root. Configuration requires `version: 3`, a nonempty `specifications.documents` list, and a `runners` object. Optional `evidence.files` selects explicit project-relative YAML paths or patterns. Omission uses `.focused-spec/evidence.yaml`; explicit sources never fall back to it. Registry paths resolve from `--root`, not the configuration file's directory. Missing matches, overlapping file claims, unsafe paths, and selected cross-file identity duplicates fail. See the [registry contract](../guides/configuration.md#required-evidence-registry).

Version 2 has no compatibility alias. Upgrade the version, keep document layouts and runner/execution settings, move bold `ID`/`EVIDENCE` rows into the registry, and bind IDs on canonical native items. The [configuration guide](../guides/configuration.md#migrate-from-version-2) is the migration reference. Runner plugins remain on `apiVersion: 1` and require no migration.
