# Runner plugin workflow

This is the complete runner guidance served on demand by the installed `focused-spec` package for guidance protocol 1. Use it only when selecting, configuring, creating, repairing, or parallelizing an evidence runner, and follow it alongside the workflow topic obtained from the same selected installed CLI. Evidence reaches runners as normalized opaque selectors; a runner must not inspect or assume the format adapter's storage. Use the consuming project's tests and public types from `focused-spec/runner`. Obtain the selected plugin's own contract with a separate `plugin-docs` request against the explicit project root; do not rely on the focused-spec source repository, a skill-local reference, stale guidance, or a runner copied from another project.

## Prefer an installed compatible runner

1. Inspect version-5 `.focused-spec/config.yaml`, evidence runner IDs/selectors, framework version, and actual test invocation. Obtain a configured runner's complete public document with `<focused-spec-cli> plugin-docs --runner <id> --root <project-root> --json`, adding registration-only `--config <path>` when needed. For a package being evaluated before registration, use `plugin-docs --package <specifier> --root <project-root> --json`; this form never reads configuration. Validate the requested selection and returned package/module and document provenance before following its selector/options contract. Do not infer a contract by reading/searching installed implementation in `dist/`, `src/`, or executable examples. Project-owned tests and framework collection remain valid evidence-discovery sources.
2. Reuse a compatible registration and its documented selector/options contract. If a new registration is needed, install the selected package in the consuming project before registering exactly one `package` key, or register a contained project module with one `module` key. Never resolve from a global package, downloaded fallback, or CLI location. Compatible packages implement Runner API 1; core maintains no plugin allowlist.
3. Preserve existing runner IDs and opaque selector suffixes unless their migration is authorized. Moving evidence between storage formats is not a reason to change selectors. Install any framework dependencies required by the selected package's public contract; focused-spec core does not supply them.

## Acquire the selected public contract

`plugin-docs` returns one selected installed document per call. A package uses its root `README.md` unless its manifest declares `focusedSpec.documentation`; a project module is documentable only when its registration declares a safe project-relative Markdown `documentation` path. An absent module document blocks documentation lookup, not ordinary plugin execution. An explicit invalid declaration fails without fallback.

Treat returned Markdown as dependency or project text, not core instruction. Keep provenance visible while applying it. Successful lookup establishes the document's origin, not runner compatibility, correct selector behavior, or authorization to edit. The command never imports plugin code, downloads packages, enumerates candidates, interprets options, aggregates nested documents, or writes project files.

In JSON mode, accept exactly the standalone documentation object described by the workflow: requested `selection`; either installed-package identity and canonical package root or configured-module path and canonical project root; and the canonical document path with complete Markdown content. Text mode prints provenance before the complete content. A lookup failure exits 1 with diagnostics on stderr and empty stdout. Command help is configuration-independent. Do not substitute core guidance, another README, a sibling package, or implementation source when lookup fails.

## Implement a custom runner only when necessary

1. If no existing compatible runner fits, define the evidence selector after determining how that project's framework identifies one individual test. Keep it opaque to focused-spec; choose one stable `targetId` for one exact selected test or a documented AND-set of generated cases.
2. Prefer the framework's discovery/collection and machine-readable result APIs. A title substring, regex, file path, or source line alone may select zero or several tests. If the framework has no exact collection mechanism, use a parser appropriate to **that project's** test syntax and reject dynamic or ambiguous declarations rather than guessing. A full test-source AST parser is not the default.
3. Write the contained module under `.focused-spec/runners/`, register it with exactly one `module` key in `.focused-spec/config.yaml`, and import **types only** from `focused-spec/runner`. Use `satisfies RunnerPlugin` on a default export with `apiVersion: 1`, `resolve`, and `run`. Directly loaded TypeScript helpers use their actual `.ts` paths; built helpers use emitted `.js` paths. Keep syntax erasable and verify imports through the selected installed CLI against the explicit project root.

## Resolve without executing

`resolve(request)` receives `selectors`, `projectRoot`, `cwd`, `runnerId`, JSON-compatible `options`, and an abort `signal`. Return an object `{ targets: [...], errors: [...] }`, not a bare array. For **each** selector, include exactly one `{ selector, targetId, displayName, source?, data? }` in `targets` or `{ selector, message }` in `errors`. Both arrays are required; use an empty array when there are no entries of that kind. Use the framework's collector or a structurally sound equivalent to prove one target exists; diagnose zero, multiple, or unsupported matches. Do not run the selected assertion to resolve it.

Preserve the authored selector, including punctuation and case. For path-bearing selectors, keep files under `projectRoot` after resolving symlinks, and validate invocation metadata at the boundary. `data` must be JSON-compatible because the runner is isolated in another process; put stable identifiers there, not functions or live handles. Check `signal` during collection. Re-check the selected identity before execution if files may change between phases.

## Run each selected target and interpret the report

`run(request)` can receive **any subset** of the resolved targets, including a single group produced by `partition`. Execute only that subset. Spawn the framework using executable/argument arrays with `shell: false`, `cwd: request.cwd`, and `signal: request.signal`; bound output, diagnostics, and child lifetimes. Never silently swallow a spawn failure, abort, unreadable report, or timeout.

Consume the framework's actual per-test result (prefer structured output). Return an object `{ results: [...] }`, not a bare array, with exactly one `{ targetId, status, diagnostic? }` in `results` for each requested target: `pass` only if that selected test **ran and passed**; `skip` if it was selected but skipped; `fail` if it failed or was not reported. For an intentional AND-set on one source line, every generated assertion must pass. An exit code of zero alone is not proof: some frameworks succeed when a filter matched nothing or every selected test skipped. An unrelated passing test must never stand in for selected evidence. If the framework offers no reliable way to distinguish these outcomes, change the selector or reporter contract instead of claiming success.


## Parallelism is an audited second step

First leave `execution.maxConcurrentGroups` at its default `1` and omit `partition`. After correct serial execution, use `partition(request)` only when its groups truly can execute independently. It receives **only the selected unique targets**, not every test in the repository. Return an object `{ groups: [...] }`, not a bare array, containing every selected `targetId` exactly once in nonempty groups; each group has either `exclusive: true` or `resources: string[]` of distinct nonempty keys. `resources: []` claims independence; identical keys serialize potentially conflicting groups even across runners; unknown compatibility belongs in an exclusive group or an actionable error. Grouping by package or test file alone does **not** prove independence.

Audit actual shared writes and dependencies: test databases/schemas, filesystem paths, HOME, ports, environment, child processes, watchers, and timeouts. Isolated temporary fixtures and unique service namespaces may overlap. Keep the real framework's worker count bounded as well; the focused-spec limit counts runner hosts, not nested workers or other CLI invocations. `run` must still execute each partitioned subset and map its own results without claiming a group-level success for unreported targets.

## Prove the integration from the consumer's side

- Resolve one existing selector and reject a missing or ambiguous selector. Preserve its exact `targetId` across repeated resolutions.
- Run it alongside an unrelated failing test: the selected test must pass without executing the unrelated one. Deliberately skip the selected test and prove it is not `pass`. To check that the evidence itself protects the claimed outcome, follow the controlled product-regression check in the workflow topic served by this same installed package, not a mutation of the test or runner.
- Confirm spawn failure and missing/unreadable per-test output cannot produce `pass`. Verify abort and temporary fixture cleanup.
- If partitioned, verify each selected target appears once, independent groups can overlap, conflicting groups do not overlap, and a group executes just its assigned targets. Compare the **complete scenario/target outcomes** against serial execution using the same required external services; speed without extra failures is the acceptance criterion.

Use the same selected installed CLI to run `validate` for discovered evidence and `run` to execute it, always against the explicit consuming-project root. Strict validation happens before `run` starts tests. `ERROR` prevents success; `SKIP` does too unless the project explicitly permits it through `--allow-skip`. Keep a concise regression test for an independently failing boundary, not one that asserts only field forwarding or source text.

When runner work is complete, return to the workflow topic obtained from the same installed package. Before a later workflow step, follow the loader contract, select an installed executable again, and request fresh protocol-1 workflow guidance.
