# Runner plugins

Use the public [runner API contract](../reference/runner-api.md), not internal package modules or implementation details. Configuration version 5 loads a runner through exactly one installed `package` or project-relative `module`; both implement unchanged `RunnerPlugin` API version 1. A module registration may additionally name a safe project-relative Markdown `documentation` file for lookup only. Package resolution starts from the consuming project, honors ESM import exports, and never falls back to a global or downloaded package. A runner must distinguish an executed selected test from a skipped, missing, ambiguous, or unreported test; a successful framework exit alone cannot establish `pass`.

## Official runners

Official framework runners use IDs `vitest`, `pytest` and `go`; optional direct scenario runners use explicitly registered IDs such as `scenarios` (JS/TS) and `scenarios-go` (Go). Install and register only the selected packages:

Each installed official runner exposes this public guide as its default root `README.md`, staged from this single authored owner. Read the selected installed contract and provenance through `npx focused-spec plugin-docs --runner <id> --json`; the package manifest may instead select another Markdown file with `focusedSpec.documentation`. Before registration, `npx focused-spec plugin-docs --package <specifier> --root <path> --json` performs the same code-free package lookup without loading configuration. Exported declarations supplement that public document; plugin implementation inspection is unnecessary. The installed core's separate `instructions --protocol 1 --topic runners --json` response contains shared Runner API obligations, not these framework-specific selectors or options.

```yaml
runners:
  vitest:
    package: '@focused-spec/runner-vitest'
  pytest:
    package: '@focused-spec/runner-pytest'
    options:
      command: uv
      commandArgs: [run, --with, pytest, python]
  go:
    package: '@focused-spec/runner-go'
```

All three accept the closed options object `{ command?: string, commandArgs?: string[] }`; invalid fields and values fail instead of silently defaulting. Vitest defaults to Node and resolves consumer-installed Vitest `^4.0.0`. Pytest defaults to `python` followed by `-m pytest`; the example retains the existing `uv run --with pytest python` prefix and supports pytest 8/9 on Python 3.10+ without an added reporter dependency. The Python reporter disables bytecode writes so execution does not modify its installed package. Go defaults to `go` followed by `test` arguments, supports Go 1.22+, and consumes real `go test -json` events. `commandArgs` is inserted after the command and before runner-controlled framework arguments. Commands are spawned without shell interpolation. The consumer owns Vitest, Python/pytest, and the Go toolchain.

| ID | Exact selector |
| --- | --- |
| `vitest` | `<project-relative-file>::<full test name>`, with nested names joined by ` > `, for example `test/a.spec.ts::outer > inner > works`; collection uses the public Vitest API and includes skipped tests |
| `pytest` | Exact collector node ID `<project-relative-file>::<class/function>[parameter-id]`; a bare parameterized parent that collects multiple cases is ambiguous |
| `go` | `<go-package>::<top-level TestName>`, for example `./auth::TestLogin`; a project-relative `.go` test file selects its containing package, preserving the authored selector; selecting a parent conservatively aggregates its subtests |

Runnable selector examples (create the corresponding ordinary framework test):

| ID | Example selector |
| --- | --- |
| `vitest` | `test/a.spec.ts::outer > inner > works` |
| `pytest` | `tests/test_auth.py::test_blocked_account` |
| `go` | `./auth::TestLogin` |

Duplicate full Vitest names within the same file are ambiguous; identical names in different files remain distinct selectors. The official runners omit `partition`, so their invocations are exclusive. They collect exact selectors and read per-test results: missing, ambiguous, skipped, failed, unexecuted, or malformed outcomes cannot become `pass` because a process exited zero.

Vitest execution selects collected public task identities in one batch, not a regex over flattened titles. Results retain both file and test identity. Distinct hierarchy paths that flatten to the same spaced name do not execute each other's tests, and literal ` > ` text in a title remains literal. All official process helpers decode stdout and stderr as UTF-8 streams, preserving multibyte characters split across output chunks.

Vitest supports Node.js 22.16.0+ in both compiled-package and source-checkout execution. When its helper is TypeScript source, the runner enables Node's type stripping as needed; consumers do not need to set `NODE_OPTIONS` or add a runtime flag. Compiled installations execute the emitted JavaScript helper.

## Direct JS/TS scenarios

`@focused-spec/runner-scenarios-typescript` implements Runner API 1 for the independent `@focused-spec/scenarios-typescript` SDK. It depends on that SDK and the public `@focused-spec/format-scenarios-typescript/catalog` parser contract. Core and SDK do not depend on these optional plugins. Other languages need their own parser/runtime integration.

```yaml
runners:
  scenarios:
    package: '@focused-spec/runner-scenarios-typescript'
```

Options are null/omitted or `{}`; every option field is rejected. The exact selector is a JSON tuple `[project-relative-suite-path, exact-scenario-id]`, not a test title or delimiter split. Example evidence: `scenarios::["specifications/account.scenarios.mjs","account.withdraw.entire-balance"]`. The prefix names the explicitly registered runner ID. The format derives this reference automatically from the native suite; no registry is needed. Read the format's installed README for literal grammar and configuration, and the SDK's README for data/type validation and independent execution.

Resolve statically rereads the suite, checks the exact opaque ID and canonical project containment of both suite and driver, and reports the scenario object's real source line. It imports neither module and runs no assertion. Paths must name project-contained JS/TS files; drivers are relative to the suite, including nested paths, and cannot escape through traversal or symlinks. Run rereads and rechecks selected targets; removed/renamed IDs fail instead of selecting by name or line.

The driver default-exports `{ given, when, cleanup? }`. `given(value, context)` prepares the real subject; `when(subject, command, context)` returns the actual JSON-compatible observation; optional `cleanup(subject, context)` releases it. Operations are awaited. Preparation/action context contains `scenarioId`, caller signal and `explain(message, data?)`. Cleanup preserves identity/explanations but omits caller cancellation, including later abort; a driver needing a release deadline owns that bound. Inputs are isolated and Actual is compared exactly to Expect. Preparation failure owns partial cleanup; otherwise cleanup runs once on success/failure. Cleanup failure prevents success; combined errors retain primary then cleanup in `AggregateError.errors`. Cancellation cannot turn matching data into PASS. Forced kill cannot guarantee release; no retries or matcher fallback is supplied.

Selected scenarios execute sequentially in a runner-owned worker; unselected scenarios are never prepared. JS and erasable `.ts`/`.mts` drivers work on Node.js 22.16.0+ without consumer flags: the worker enables experimental type stripping on Node 22.16/22.17. Non-erasable TypeScript is unsupported. Driver modules are trusted project code, not a sandbox; module globals may persist between selected scenarios. Cancellation is cooperative, followed by forced termination after 500 ms if needed; forced kill cannot guarantee cleanup. Core's configured runner timeout also bounds execution. Input, captured stdout/stderr and each result message are bounded at 4,000,000 bytes; diagnostics are bounded to 8,000 characters. Crashes, invalid transport or missing results never pass. Application stdout is not a result channel.

The worker captures SDK `Given`, `When`, `Expect`, available valid `Actual` and real explanation events per target, retaining them on ordinary mismatch/application error as well as pass. Each stream is bounded before transport to 256 records and 65,536 encoded UTF-8 bytes with a terminal truncation marker; see [event schema and retention](../reference/runner-api.md#execution-events). Collection does not alter exact verification. Events use worker messages, never parsed application stdout. Buffered records are unavailable if the worker dies before reporting; a missing result still fails. `run --details` exposes passing records, while JSON always includes them.

The runner, not core, translates SDK observations into generic events with the SDK name as `message` and `{ value: ... }` or `{ text: ... }` as `data`. Explanations retain their message and optional data. Core accepts arbitrary producer-defined kinds and renders every event uniformly.

After installing core, SDK and both plugins and configuring the format/runner, exercise the same suite:

```sh
./node_modules/.bin/focused-spec list
./node_modules/.bin/focused-spec show account.withdraw.entire-balance
./node_modules/.bin/focused-spec validate --syntax-only
./node_modules/.bin/focused-spec validate --strict
./node_modules/.bin/focused-spec run --scenario account.withdraw.entire-balance
./node_modules/.bin/focused-spec run
```

Ordinary Node test registration remains independent: import the same suite and driver and call `verifySpecification(driver, scenario)` in each test. The repository bank example demonstrates both paths; neither inspection nor strict validation executes its driver.

## Direct Go scenarios

`@focused-spec/runner-scenarios-go` executes native Go scenarios through the independent Go SDK. It requires Node.js 22.16.0+ and a consumer-installed Go 1.23+ toolchain, and depends on the public `@focused-spec/format-scenarios-go/catalog` API, not another parser. It does not install Go or download a toolchain. The [Go format contract](../../packages/formats/scenarios-go/README.md) owns native syntax and format options; the [Go SDK](../../packages/sdk/go/README.md) owns typed comparison and driver lifecycle.

```yaml
runners:
  scenarios-go:
    package: '@focused-spec/runner-scenarios-go'
    timeoutMs: 120000
```

Options are omitted/null or `{}`; unknown fields fail. The exact selector is `[project-relative-suite-path, exact-scenario-id]` encoded as JSON, for example `scenarios-go::["specifications/account.scenarios.go","account.withdraw.entire-balance"]`. The format derives it directly; no Markdown companion or consumer registry is needed. IDs retain exact Unicode, case, spaces and punctuation. Source and driver paths must remain canonically inside the project, and the driver must be an exported variable in a same-package Go source file.

Resolve statically parses the suite and driver without executing consumer initializers or actions; strict validation does not typecheck the application. Run rereads selected identities, identifies their project-contained module and importable package, builds a temporary bridge against the consumer's SDK dependency, and executes only selected driver actions sequentially. Ordinary Go tests call that same SDK. Go compilation may fail on malformed driver types or inactive source files: those are nonpassing execution outcomes, not validation guarantees.

Execution uses a dedicated bounded report, not stdout or an exit-code-only check. Every selected ID must have one real result; missing/duplicate/invalid reports, compilation failure, panic, process failure and cancellation never pass. Application stdout/stderr and report/input are each bounded at 4,000,000 bytes; surfaced diagnostics at 8,000 characters. Temporary bridge paths are removed after success or failure. The normal Go build cache may remain. Module/workspace execution uses the owning `go.mod` with `GOWORK=off` and `GOTOOLCHAIN=local`; install dependencies before running.

Application packages and their dependencies are trusted Go code, not a sandbox: their `init` functions run during execution, even though unselected actions are never prepared. Context cancellation is cooperative; the process tree is terminated after 500 ms if necessary. SDK cleanup gets a noncancelled context after successful preparation; forced termination cannot guarantee cleanup. No partitioning, retries or matcher fallback is provided.

Each selected scenario receives its own SDK `WithEvents` context. The bridge retains observations and explanations on pass and ordinary SDK mismatch/application error, bounded to 256 records and 65,536 encoded UTF-8 bytes per target with visible truncation. Go values outside faithful portable JSON use explicit text observations without changing typed equality. Events travel in the private report, never application stdout. The independent 4,000,000-byte whole-report cap remains: per-target retention does not guarantee an arbitrarily large batch fits. A panic, cancellation or process failure before the final report cannot recover partial events or become a pass. Use `run --details` or JSON to inspect retained records.

The bridge owns SDK-to-core translation: observation names become `message`, portable values become `data: { value: ... }` and explicit text becomes `data: { text: ... }`. Explanations preserve their message/data. The generic core neither imports SDK event types nor interprets their kinds.

After installing the selected packages and configuring the format/runner, use the same list/show/validate/run commands above. See [both standalone bank consumers](configuration.md#standalone-executable-bank-specifications) for exact checkout commands.

## Custom runners

Before writing one, inspect the project's existing runner registrations and acquire public contracts for compatible installed packages, official or third-party; reuse a compatible selector contract rather than creating a second plugin. Register a custom project module only when no existing compatible runner fits; add `documentation: <project-relative Markdown file>` beside `module` when it should be discoverable through `plugin-docs`. For an agent selecting, configuring, implementing, or repairing a runner, the package-owned [runner guidance](../../guidance/runners.md) provides shared collection, report interpretation, and verification rules. The project's explicit installed CLI serves that topic through a standalone `instructions --protocol 1 --topic runners --json` call, followed by a separate `plugin-docs --runner <id> --json` request for the selected contract. No skill-local reference, global/downloaded CLI, source checkout, or another plugin document is a fallback. Start with serial execution.

## Optional execution groups

When a project opts into `execution.maxConcurrentGroups > 1`, a runner can implement `partition(request)` to map the **selected** targets to independently executable groups. For example, a runner may return:

```ts
{
  groups: [
    { targetIds: ['accounts'], resources: ['postgres:integration'] },
    { targetIds: ['billing'], resources: ['postgres:integration'] },
    { targetIds: ['parser'], resources: [] },
    { targetIds: ['unknown'], exclusive: true },
  ],
}
```

`accounts` and `billing` cannot overlap; `parser` can run with either; `unknown` runs alone. Each selected target must appear exactly once. The runner decides how to derive these groups and resource keys—its code, its own config, or framework metadata. No runner-specific policy format is mandated by `focused-spec`. An empty `resources` array is an explicit assertion of independence, **not** a default for unclassified tests. If safety cannot be established, declare an exclusive group or return an actionable error.

The core calls `run` separately for each group, so the plugin must execute arbitrary declared subsets and report each target's actual status. Existing plugins without `partition` keep one exclusive `run` call and need no migration. The global limit counts concurrent runner hosts, not Vitest/Jest/pytest/Go workers; tune framework worker limits separately to avoid nested oversubscription. Resource exclusion protects only groups in the same `focused-spec run`, not tests started in another process. Exact request/response and validation rules live in the [runner API reference](../reference/runner-api.md).
