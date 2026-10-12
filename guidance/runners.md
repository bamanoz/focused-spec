# Runner plugin workflow

This is the complete runner guidance served on demand by the installed `focused-spec` package for guidance protocol 1. Use it only when selecting, creating, repairing, or parallelizing an evidence runner, and follow it alongside the workflow topic obtained from the same package. Use the consuming project's tests, the same explicitly resolved project-local CLI that served this guidance, and public types from `focused-spec/runner`. Do not rely on the focused-spec source repository, a skill-local reference, a global/downloaded CLI, or a runner copied from another project.

## Prefer an installed compatible runner

1. Inspect `.focused-spec/config.yaml`, installed package manifests, public runner `README.md`/type declarations, existing project modules, evidence runner IDs/selectors, framework version and actual test invocation. Official public contracts are at `node_modules/@focused-spec/runner-vitest/README.md`, `node_modules/@focused-spec/runner-pytest/README.md` and `node_modules/@focused-spec/runner-go/README.md`; the options and selectors below are sufficient when a README is unavailable. Do not read/search installed plugin `dist/`, `src/` or executable examples to infer its contract. Project-owned tests and framework collection remain valid evidence-discovery sources. Do this before installing or authoring anything. Reuse a compatible registration and selector contract rather than creating a parallel plugin or changing opaque selectors.
2. When an official package fits, install it in the consuming project before registering it: `@focused-spec/runner-vitest`, `@focused-spec/runner-pytest`, or `@focused-spec/runner-go`. Use the framework-only runner IDs `vitest`, `pytest`, and `go` for new registrations. The framework remains a separate consumer dependency. Register the package with exactly one `package` key; never use a global package, downloaded fallback, or loader-relative resolution.
3. Official runner options are the closed object `{ command?: string, commandArgs?: string[] }`. Vitest defaults to Node plus the consumer-installed Vitest 4.x entrypoint. Pytest defaults to `python -m pytest` on Python 3.10+ with pytest 8/9; `command: uv` with `commandArgs: [run, --with, pytest, python]` produces the supported `uv run --with pytest python -m pytest` prefix. Go defaults to `go test` and supports Go 1.22+. Invalid options fail. Commands use argument arrays without shell interpolation. The official runners omit `partition` and therefore run exclusively.
4. Use exact official selectors: Vitest `<project-relative-file>::<full test name>`, with nested names separated by ` > ` exactly as collected; pytest's exact collector node ID `<project-relative-file>::<class/function>[parameter-id]`; Go `<go-package>::<top-level TestName>`, or a project-relative `.go` test file naming its containing package. Preserve the authored selector. Duplicate Vitest names and a pytest selector that expands to multiple parameter cases are ambiguous. Go conservatively aggregates the selected parent test's subtests.

## Implement a custom runner only when necessary

1. If no installed runner fits, define the evidence selector after determining how that project's framework identifies one individual test (for example, a pytest node ID). Keep it opaque to focused-spec; choose one stable `targetId` for one exact selected test or a documented AND-set of generated cases.
2. Prefer the framework's discovery/collection and machine-readable result APIs. A title substring, regex, file path, or source line alone may select zero or several tests. If the framework has no exact collection mechanism, use a parser appropriate to **that project's** test syntax and reject dynamic or ambiguous declarations rather than guessing. A full test-source AST parser is not the default.
3. Write the contained module under `.focused-spec/runners/`, register it with exactly one `module` key in `.focused-spec/config.yaml`, and import **types only** from `focused-spec/runner`. Use `satisfies RunnerPlugin` on a default export with `apiVersion: 1`, `resolve`, and `run`. Directly loaded TypeScript helpers use their actual `.ts` paths; built helpers use emitted `.js` paths. Keep syntax erasable and verify imports through the installed project-local CLI.

## Resolve without executing

`resolve(request)` receives `selectors`, `projectRoot`, `cwd`, `runnerId`, JSON-compatible `options`, and an abort `signal`. Return an object `{ targets: [...], errors: [...] }`, not a bare array. For **each** selector, include exactly one `{ selector, targetId, displayName, source?, data? }` in `targets` or `{ selector, message }` in `errors`. Both arrays are required; use an empty array when there are no entries of that kind. Use the framework's collector or a structurally sound equivalent to prove one target exists; diagnose zero, multiple, or unsupported matches. Do not run the selected assertion to resolve it.

Preserve the authored selector, including punctuation and case. For path-bearing selectors, keep files under `projectRoot` after resolving symlinks, and validate invocation metadata at the boundary. `data` must be JSON-compatible because the runner is isolated in another process; put stable identifiers there, not functions or live handles. Check `signal` during collection. Re-check the selected identity before execution if files may change between phases.

## Run each selected target and interpret the report

`run(request)` can receive **any subset** of the resolved targets, including a single group produced by `partition`. Execute only that subset. Spawn the framework using executable/argument arrays with `shell: false`, `cwd: request.cwd`, and `signal: request.signal`; bound output, diagnostics, and child lifetimes. Never silently swallow a spawn failure, abort, unreadable report, or timeout.

Consume the framework's actual per-test result (prefer structured output). Return an object `{ results: [...] }`, not a bare array, with exactly one `{ targetId, status, diagnostic? }` in `results` for each requested target: `pass` only if that selected test **ran and passed**; `skip` if it was selected but skipped; `fail` if it failed or was not reported. For an intentional AND-set on one source line, every generated assertion must pass. An exit code of zero alone is not proof: some frameworks succeed when a filter matched nothing or every selected test skipped. An unrelated passing test must never stand in for selected evidence. If the framework offers no reliable way to distinguish these outcomes, change the selector or reporter contract instead of claiming success.

### Concrete result check: Go test

For a test named `TestBlockedAccount`, a Go runner can collect with `go test ./auth -list '^TestBlockedAccount$'` and execute with `go test -json ./auth -run '^TestBlockedAccount$' -count=1` (escape metacharacters when constructing an exact regex from an authored name). Parse the JSON-lines events and filter on **exactly** `Test: "TestBlockedAccount"`:

```ts
const selected = events.filter(event => event.Test === testName)
const ran = selected.some(event => event.Action === 'run')
const terminal = selected.filter(event => ['pass', 'fail', 'skip'].includes(event.Action))
const action = terminal.length === 1 ? terminal[0]!.Action : undefined
const status = !ran || action === undefined || (action === 'pass' && exitCode !== 0)
  ? 'fail'
  : action === 'pass' ? 'pass' : action === 'skip' ? 'skip' : 'fail'
```

The package-level `pass` event has no `Test` and is **not** evidence: `go test -run '^TestMissing$'` can exit zero with `[no tests to run]`. Reject malformed JSON, duplicate terminal events, and missing `run` events; include a bounded diagnostic on failure. For parent tests with subtests, decide whether the selector names one leaf or an AND-set and inspect every selected child outcome accordingly. This is an illustration of report interpretation, not a copy-paste runner for other frameworks.

## Parallelism is an audited second step

First leave `execution.maxConcurrentGroups` at its default `1` and omit `partition`. After correct serial execution, use `partition(request)` only when its groups truly can execute independently. It receives **only the selected unique targets**, not every test in the repository. Return an object `{ groups: [...] }`, not a bare array, containing every selected `targetId` exactly once in nonempty groups; each group has either `exclusive: true` or `resources: string[]` of distinct nonempty keys. `resources: []` claims independence; identical keys serialize potentially conflicting groups even across runners; unknown compatibility belongs in an exclusive group or an actionable error. Grouping by package or test file alone does **not** prove independence.

Audit actual shared writes and dependencies: test databases/schemas, filesystem paths, HOME, ports, environment, child processes, watchers, and timeouts. Isolated temporary fixtures and unique service namespaces may overlap. Keep the real framework's worker count bounded as well; the focused-spec limit counts runner hosts, not nested workers or other CLI invocations. `run` must still execute each partitioned subset and map its own results without claiming a group-level success for unreported targets.

## Prove the integration from the consumer's side

- Resolve one existing selector and reject a missing or ambiguous selector. Preserve its exact `targetId` across repeated resolutions.
- Run it alongside an unrelated failing test: the selected test must pass without executing the unrelated one. Deliberately skip the selected test and prove it is not `pass`. To check that the evidence itself protects the claimed outcome, follow the controlled product-regression check in the workflow topic served by this same installed package, not a mutation of the test or runner.
- Confirm spawn failure and missing/unreadable per-test output cannot produce `pass`. Verify abort and temporary fixture cleanup.
- If partitioned, verify each selected target appears once, independent groups can overlap, conflicting groups do not overlap, and a group executes just its assigned targets. Compare the **complete scenario/target outcomes** against serial execution using the same required external services; speed without extra failures is the acceptance criterion.

Use the same explicitly resolved project-local CLI to run `validate` for discovered evidence and `run` to execute it. Strict validation happens before `run` starts tests. `SKIP`/`ERROR` need an explicit CLI skip policy or they prevent success. Keep a concise regression test for an independently failing boundary, not one that asserts only field forwarding or source text.

When runner work is complete, return to the workflow topic obtained from the same installed package. Before a later workflow step, follow the loader contract and request fresh protocol-1 workflow guidance from the consuming project's explicit local installation.
