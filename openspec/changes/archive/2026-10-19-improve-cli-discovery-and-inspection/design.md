# Design

## Context

See proposal.md for motivation. The CLI owns parsing/transport; `validateFocusedSpecs` already supports exact scenario selection and returns normalized selected documents. Format API 2 provides native and evidence source locations. Existing command results are public contracts, not candidates for a universal success envelope. No TypeScript language server is available in this workspace; inspect textual references before changing exported symbols.

## Goals / Non-Goals

**Goals:** implement all four approved CLI improvements using existing configuration, discovery and validation boundaries; keep deterministic output and preserve opaque identities.

**Non-Goals:** lifecycle/install management, public TypeScript API changes, dependency or contract-version changes, releases, integration refresh, spec sync and archive.

## Decisions

### Offline identity

A CLI-only `cli-version.ts` exports `readVersion(): Promise<VersionInformation>` and `displayVersion(info, json): void`. Read the manifest beside the invoked core distribution; canonical executable is that distribution's `cli.js`. Output is `{ package: { name, version }, executable, runtime: { node }, contracts: { guidance: 1, configuration: 5, format: 2, runner: 1 } }`. Text is `focused-spec <version>`. `version [--json]`, `--version` and `-V` accept no ignored extras or duplicate flags. Explicit supported help wins. Avoid project package resolution or update checks.

### Error boundary

CLI-only `cli-error.ts` exports `argumentError(message, command?): Error`, `jsonRequested(argumentsList): boolean` and `printCliError(error, json): void`. Usage errors carry a typed identity and a pasteable `focused-spec [command] --help` pointer. JSON stderr is `{ error: { code: 'invalid_arguments' | 'command_failed', message, help? } }`; exit 1 and no stdout. Human diagnostics retain message/help. The central CLI catch renders thrown errors once.

`jsonRequested` recognizes actual options, not opaque values: skip consumed `--scenario` values even when flag-looking; skip accepted ordinary option values; do not swallow a rejected flag-looking ordinary value; stop at show's positional `--`. Unknown commands still recognize an actual `--json`. Init parses and checks required noninteractive selection before its installation-report catch. Valid installation failures retain stdout reports and omit redundant plaintext stderr in JSON mode. Instructions parsing uses the shared usage error. Existing validation/run business JSON remains untouched.

### Selection symmetry

Remove validate's run-only scenario restriction, retain run-only allow-skip and validate-only strict/syntax-only. Forward scenario selection to `validateFocusedSpecs` for either command and include it in validation context. No changes to core validation/discovery or public exports are required.

### Inspection

New CLI-only `inspection.ts` exports `inspectEnrollments(root, configPath?, options?): Promise<InspectionResult>` and `displayInspection(result, json): void`. Options are `{ scopeName?: string, scenarioId?: string }`. It uses `loadConfig` and `validateFocusedSpecs(..., { strict: false, ...selection })`, never the planner or runners.

Syntax: `list [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--json]`; `show <id> [--root <path>] [--config <path>] [--scope <name>] [--json]`. Show supports `-- <id>` for its single exact positional ID, with options before the delimiter. Duplicate, missing, unknown or excess arguments fail.

Success is `{ valid: true, selection, scenarios }`, failure `{ valid: false, selection, violations }` with no scenarios. Selection is `{ scopes: { mode: 'all' } | { mode: 'selected', name }, scenario?: string }`. A scenario is `{ scope, id, name, source: { path, line }, evidence: [{ reference, source: { path, line } }] }`. Native source uses scenario path/line. Evidence source precedence is `evidenceLocations[index]`, then `evidenceLocation`, then native source. Preserve reference order and exact strings; sort rows by raw scope then raw ID. Do not read returned origin paths. Text exposes the same provenance, never PASS. Config failures become failed inspection results; unexpected thrown failures use central transport.

### Integration ownership

Main exclusively owns `packages/core/src/cli.ts`. Independent implementation slices may own version/error/init/instructions modules, inspection module and tests, and CLI boundary/selection/packed tests. Each slice skips builds/tests/formatters; Main integrates and validates once. No shared-file edits concurrently. New modules are not root package exports.

## Exact evidence plan

Register only during apply, using existing capability-owned registry files and a new `.focused-spec/evidence/evidence-inspection.yaml` for the new capability. Every occurrence belongs to scope `improve-cli-discovery-and-inspection`.

- `cli.version.offline`: `test/cli-discovery.spec.ts` — `CLI discovery and transport > reports invoked offline identity and rejects ignored version arguments`; packed-consumer identity assertion in `test/package.spec.ts`.
- `cli.errors.json`, `cli.errors.runtime`, `cli.errors.opaque-values`: separate exact tests in `CLI discovery and transport` for argument errors, lookup failure, and opaque option values.
- `cli.help.discovery-inspection`: exact offline help test in the same suite.
- `validation.selection.scenario`, `validation.selection.modes`: separate CLI selection tests proving isolation, actual resolved selectors, mode policies and absence boundaries.
- `init.output.json`: preserve exact existing packed/init result behavior evidence; `init.output.invalid-invocation`: exact CLI transport test with no writes.
- `inspection.list.read-only`, `inspection.show.selection`, `inspection.output.provenance`, `inspection.errors.structural`: four separate tests in `test/inspection.spec.ts` guarding nonexecution, selection, provenance and fail-closed results. Use exact full Vitest names from implemented tests when integrating.

Run native strict validation, build/typecheck and narrow behavior tests, installed/packed CLI smoke, exact focused validation/execution and full scope. Introduce controlled disposable product regressions for each changed outcome, require its exact assertion to fail, restore and rerun to PASS. Then run `npm test` and real `npm run smoke`; validate documentation links/index reachability and staged guidance. No skipped or failed check is a pass.

## Risks / Trade-offs

- Flag-looking IDs can accidentally trigger JSON/help → recognize value boundaries and show's delimiter; retain existing help precedence for actual help options.
- Inspection imports trusted format parsers/binders → explicitly document this; only runners are forbidden, not format execution.
- Selectors isolate semantic entries, not unreadable structural sources → reuse current validation instead of promising stronger isolation.
- JSON init argument errors intentionally change transport → document the breaking distinction; preserve installation conflict/partial-write reporting.
- Source locations are plugin-provided provenance, not read authorization → display without opening returned paths.
