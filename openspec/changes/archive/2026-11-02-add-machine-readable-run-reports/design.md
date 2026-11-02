# Design

## Context

See [proposal.md](./proposal.md) for motivation. The existing `run --json` result is emitted from `ExecutionResult` plus `executionStarted`, selection context and optional timings. It includes each scenario's `scope`, exact `id`, `name`, native source `{path,line}`, scenario status, and evidence status/reference/optional diagnostic/events; the failing-preflight JSON instead contains violations, `executionStarted: false`, and the same selection context. The CLI currently writes JSON to stdout and has no output-file path or report side effect.

The repository has no existing GitHub Action; `.github` is not present in the current workspace listing. The composite action is therefore a new consumer entrypoint and must not assume a particular install strategy that is not established by an existing action contract.

## Goals / Non-Goals

**Goals:** Derive standard JUnit XML from the already-computed CLI result, preserving identity and real status. Keep output-path and CI failure behavior explicit. Provide a reusable composite Action whose outcome cannot mask CLI failure and whose documented PR usage does not grant untrusted code secrets or write permissions.

**Non-Goals:** Replace or version the current `--json` contract, map scenario execution to SARIF, add focused-spec-specific artifact upload permissions, install dependencies implicitly, alter runner behavior, or integrate OpenSpec/Spec Kit authoring, validation, or lifecycle.

## Decisions

1. **JUnit is the report format.** It maps naturally to CI test consumers. Existing JSON already includes detailed evidence and execution context, so a second JSON document/file would duplicate the stable contract. SARIF is not chosen: execution results do not provide meaningful static-analysis rule identities and code locations; scenario source locations identify native requirements, not defects.
2. **One test case per selected scenario occurrence.** Use a collision-free identity formed from scope plus exact ID (for example, a stable delimited or escaped tuple), with the native scenario name as the display name and native source path/line in standard testcase properties or equivalent JUnit metadata. Do not use evidence targets as extra test cases: targets may be shared, while scenario status represents the AND contract.
3. **Map outcomes without losing semantics.** PASS has no failure child; FAIL maps to `<failure>`, ERROR to `<error>`, and SKIP to `<skipped>`. Preserve scenario status and evidence references/diagnostics in detail text or properties. Include failing/error evidence details, but do not include passing events by default. Escape XML metacharacters and reject/replace XML 1.0-invalid code points deterministically.
4. **Use an opt-in path option, likely `--junit <path>`.** Resolve relative paths against `--root`, create the destination only when requested, and write atomically through a temporary sibling followed by rename so partial XML is not left on failure. Keep the same execution and exit code; inability to write a requested report makes the CLI unsuccessful and emits an actionable diagnostic. Continue to provide the original JSON business-result on stdout in `--json` mode, so consumers retain actual scenarios/violations when report writing fails.
5. **Represent preflight without fabricating test results.** When validation/resolution fails, write a valid report containing a suite-level failure with the actual violations and zero testcases; do not turn the blocked scenarios into executed failures or passes. A valid zero-target/zero-scenario run yields an empty suite and retains the existing CLI success policy.
6. **Composite Action consumes an existing CLI.** It invokes the CLI from a caller-controlled checkout/install step, passes an explicit report path and caller arguments safely, and exposes both the report path and truthful success outcome. Use `always()` only in caller examples for artifact collection, not to override the action's failure. Do not automatically upload artifacts or request token permissions.
7. **Untrusted PR guidance is least privilege.** Provide a `pull_request` example with `permissions: contents: read`, no secrets/token passed to the action, and report upload in the same unprivileged job only if the selected artifact mechanism is safe for untrusted content. Do not recommend `pull_request_target` to execute checkout PR code, nor combine untrusted execution with privileged publishing/commenting. If privileged publication is desired, require a separate trusted workflow that treats downloaded reports as untrusted data and validates them before use.
8. **Evidence selectors remain planning-only.** Exact CLI and Action evidence is recorded below; enrollment is deferred to apply, and this proposal does not create workflow files or integration.

## Exact evidence

| Native ID | Required evidence |
| --- | --- |
| `execution.report.junit` | `vitest::test/cli-reports-native.spec.ts::focused-spec CLI > writes escaped JUnit cases for PASS FAIL ERROR and SKIP scenarios` |
| `execution.report.preflight` | `vitest::test/cli-reports.spec.ts::focused-spec CLI > writes a suite-level preflight failure without fabricated cases` |
| `execution.report.empty` | `vitest::test/cli-reports.spec.ts::focused-spec CLI > writes an empty suite for a valid empty execution and fails clearly on report output errors` |
| `execution.report.output-errors` | `vitest::test/cli-reports.spec.ts::focused-spec CLI > writes an empty suite for a valid empty execution and fails clearly on report output errors`; `vitest::test/cli-reports.spec.ts::focused-spec CLI > writes a suite-level preflight failure without fabricated cases` |
| `execution.report.github-action` | `vitest::test/github-action.spec.ts::composite GitHub Action contract > executes the Action script against an installed CLI and preserves report/output status` |
| `execution.report.untrusted-pr` | `vitest::test/github-action.spec.ts::composite GitHub Action contract > provides a read-only pull_request example with no credential or privileged publishing flow`

These exact selectors are enrolled under the change scope in `.focused-spec/evidence/scenario-execution.yaml`. The report case also parses a real CLI-generated JUnit file with Python's standard-library XML parser. GitHub-hosted Action execution is not claimed; local YAML/action contract tests verify argv and permission boundaries.

## Risks / Trade-offs

- JUnit dialects vary. Keep the emitted schema conventional and test it with a real XML parser and a common CI consumer where available; retain extension details in properties/text rather than relying on vendor-specific elements.
- A report-write failure occurs after execution may already have happened. Preserve the JSON result and make the report I/O failure explicit; never rerun tests to recover the report.
- GitHub Action inputs that accept arbitrary args can be injection-prone if interpolated into a shell script. Pass values through environment variables or an argument array and document what caller-provided commands are trusted to execute.
- Workflow syntax tests cannot prove hosting-platform permissions. Validate YAML/action metadata locally, then confirm the untrusted-PR example's declared permissions and token/secret boundaries by inspection.
