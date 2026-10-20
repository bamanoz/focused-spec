# Design

## Context

See [proposal](./proposal.md) for motivation and [Go behavioral delta](./specs/go-executable-scenarios/spec.md) for outcomes. Existing JS/TS SDK, native format and direct runner are separate packages. Core consumes Format API 2 and Runner API 1. The ordinary Go runner resolves only top-level `TestName`; it cannot select one opaque ID from a native suite and is not a compatible replacement.

`add-executable-scenario-sdk` is implemented but unsynced. Preserve its artifacts and bindings. Its bank integration test imports the old example path; update that test's fixture source while preserving its selector and assertion. Go 1.26.1 is installed; existing examples declare Go 1.23. Node baseline remains 22.16.0.

## Goals / Non-Goals

**Goals:** idiomatic typed Go application drivers, independently reusable native declarations, exact selected execution, and source inspection that never runs consumer code. Compare identical domain outcomes across two languages without a shared generated scenario store.

**Non-Goals:** no HTTP server, persistence layer, universal cross-language DSL, retries, matcher language, automatic toolchain installation, new core protocol, npm SDK wrapper, release or lifecycle publication. The existing service is an in-memory account; preserve that boundary rather than invent a network service.

## Decisions

### 1. A real Go module, not an npm wrapper

Create `packages/sdk/go/go.mod`, module `github.com/bamanoz/focused-spec/packages/sdk/go`, package `scenarios`, Go 1.23, standard library only. Authored files: `scenarios.go`, `scenarios_test.go`, `README.md`, `LICENSE`. Go types and functions belong here, never under core or the npm plugins. Future module publication requires `packages/sdk/go/vX.Y.Z` tags; this change does not create them or claim a registry installation works before publication.

Use generic `Scenario[Given, When, Expect]` with `ID`, `Name`, `Given`, `When`, `Expect`; `Suite[Given, When, Expect]` with `Driver` and `Scenarios`; and `Driver[Subject, Given, When, Expect]` with function fields `Given`, `When`, optional `Cleanup`. All operations receive a context. `VerifySpecification` returns the typed actual observation and an error. `ValidateScenario` and `ValidateSuite` are explicit functions, not panicking constructors. `DriverBinding{Path, Export}` is inert metadata for optional integration; standalone callers pass their driver directly.

Use typed structural equality (`reflect.DeepEqual`), not serialized JSON equality: nil and empty slices differ, integers remain integers and event order matters. Values are recursively data-only: finite scalar values, arrays/slices, string-keyed maps and structs with exported data fields; reject functions, channels, unsafe pointers, cycles, nonfinite values, unexported state and custom serialization hooks. Validate before invoking a driver. Clone Given and When before preparation while preserving concrete types and nil values; clone even if they alias Expect. Do not serialize/deserialize through `any` or let a custom marshaler conceal unsupported state. Only diagnostics and IPC are JSON; typed domain values remain in Go.

Go cannot distinguish an omitted struct field from an explicitly authored zero value at runtime. SDK callers may intentionally construct zero-valued data; the optional static grammar requires all five scenario fields to be present. Document this distinction rather than inventing a runtime omission detector.

Cleanup follows successful preparation exactly once through a defer. It receives `context.WithoutCancel(ctx)` so cancellation does not prohibit release; driver cleanup remains responsible for its own time bound. Use `errors.Join` to retain primary and cleanup errors and a typed mismatch error with identity, expected and actual values. Preparation failures own partial acquisition cleanup. Check cancellation before preparation and before/after action. A panic must never become success; deferred cleanup executes during unwinding, while process-level panic/exit remains a nonpassing runner outcome. No claim of cleanup after forced termination.

### 2. Restricted typed Go declarations, parsed by Go

Native files end in `.scenarios.go`, have a normal non-main package, and declare exactly one exported suite variable. Example grammar:

```go
package specifications

import (
    scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
    "example.com/scenario-bank/bank"
)

var Account = scenarios.Suite[[]bank.Event, bank.Command, []bank.Event]{
    Driver: scenarios.DriverBinding{Path: "account.driver.go", Export: "AccountDriver"},
    Scenarios: []scenarios.Scenario[[]bank.Event, bank.Command, []bank.Event]{
        {
            ID: "account.withdraw.entire-balance",
            Name: "Withdrawing the entire balance is allowed",
            Given: []bank.Event{
                {Type: "AccountOpened"},
                {Type: "MoneyDeposited", Cents: 5000},
            },
            When: bank.Command{Type: "WithdrawMoney", Cents: 5000},
            Expect: []bank.Event{{Type: "MoneyWithdrawn", Cents: 5000}},
        },
    },
}
```

The driver file is in the same directory/package and declares exported `AccountDriver`, a typed driver value. Ordinary Go tests and the demo import `Account` and `AccountDriver` directly. Driver names are compiler-checked during execution; strict resolution checks their syntactic presence, not type correctness.

Use `go/parser`, `go/ast`, `go/token` and `strconv` in a standard-library helper at `packages/formats/scenarios-go/go/catalog.go`. It reads one bounded JSON request `{path, source}` from stdin and returns a bounded JSON catalog or diagnostics. It parses the supplied source, not an unrelated disk revision. It never imports, builds or executes the consumer. `go run` compiles only this distributed helper; use an isolated helper working directory and module/workspace settings, not the consumer's replacement graph. Missing Go fails explicitly; no toolchain download or regex fallback.

Recognize the SDK import path and its local alias, generic suite/scenario composite literals, keyed struct fields, string/raw-string/numeric/bool/nil literals, negative numbers, nested composites and literal string-keyed maps. Parse identifiers in type positions but do not evaluate constant references, calls, concatenation, expressions, generated lists or spread-like constructs. Reject duplicate fields/IDs, missing scenario fields, extra scenario/suite fields, multiple suites, build-constrained scenario files, dot/blank SDK imports and unsupported executable declarations with real source lines. Imports are inert; no `init`, function declaration or additional variable initializer is permitted in a selected scenario source. Application and driver code belong in other Go files. Scope-local ID conflict enforcement stays in core.

Catalog entries contain exact ID/name/line plus suite export, package name and driver binding. Type checking is intentionally deferred to Go execution. Runtime validation uses the same ID validity rule as discovery; do not normalize Unicode, case, spaces or punctuation. The public npm `/catalog` export owns selector encode/decode, helper invocation and catalog types so format and runner do not implement separate grammars.

### 3. Explicit plugins and automatic evidence

Add npm workspaces `packages/formats/scenarios-go/` and `packages/runners/scenarios-go/` at the existing suite version, with normal ESM/types builds and focused-spec peer ranges. The runner depends on the format's public catalog API; neither depends on a nonexistent npm Go SDK. Stage the parser Go source into the format's own `dist/` asset tree after compilation and include it in tarballs. Never load helper source from this checkout at runtime.

Format options are exactly `{runner: string}`. Runner options are omitted/null or `{}`; reject unknown fields. Both use the consumer-provided `go` executable from PATH. Document the prerequisite and minimum Go version; no custom launcher options are needed for this example. Plugin calls honor signals and bounded output.

Selector is the JSON tuple `[projectRelativeSuitePath, exactScenarioID]`, matching the established direct-scenario convention. It is opaque to core. References use the explicit registered runner prefix; Go example uses `scenarios-go`. JSON encoding prevents `::`, quotes or slashes inside an ID from changing selection. Paths must be project-relative `.scenarios.go`, without absolute components, traversal, controls or backslashes.

Proposed Go example configuration at `examples/scenarios/go/.focused-spec/config.yaml`:

```yaml
version: 5
specifications:
  formats:
    scenarios-go:
      package: '@focused-spec/format-scenarios-go'
      options: { runner: scenarios-go }
  documents:
    - match: specifications/**/*.scenarios.go
      scope: current
      format: scenarios-go
runners:
  scenarios-go:
    package: '@focused-spec/runner-scenarios-go'
    timeoutMs: 120000
```

Each native item directly supplies one derived reference such as `scenarios-go::["specifications/account.scenarios.go","account.withdraw.entire-balance"]`, with its declaration as provenance. No consumer registry, Markdown copy or core edit. TypeScript configuration keeps its current registration and selector suffixes relative to its relocated root.

### 4. Static resolve; compiled direct execution

Resolve rereads and parses selected sources, verifies one exact ID, canonical containment of suite and driver, same-package driver source and exported driver binding. Canonical project/module containment is checked again at run. It executes no consumer code and does not use `go test -list`, which may run consumer initialization. Stable target ID is the encoded selector, never a test title or source line.

Run groups selected targets by suite and processes them serially, with no partition claim. Find the nearest project-contained `go.mod`, obtain the suite package import path with `go list -find -json` only during execution, and reject an unimportable main package, inactive file or unsupported module layout rather than guessing. Create a unique temporary bridge directory inside that module so its dependencies and replacement directives remain consumer-owned. No persistent generated consumer file or `go.mod` rewrite. A clean consumer must have its actual dependency graph installed; offline SDK use works through an explicit local module replacement.

Generate a small main importing only the SDK and selected specification package. It calls the suite export and driver export, validates the runtime suite, finds the exact requested IDs and invokes `VerifySpecification` for each. Exchange requested identities via JSON stdin, never Go code interpolation. Validate package import paths and exported identifiers; quote generated import strings with a proper string encoder. Consumer package imports may execute `init` during run, just like ordinary Go execution; this is trusted project code, not isolation from initializer side effects. Unselected driver actions are never prepared.

Build with `go build -o <temporary executable>` and launch that executable directly using argument arrays, no shell, in the owning module with `GOTOOLCHAIN=local` and `GOWORK=off`. This delivers cancellation to the application process itself; the bridge handles SIGTERM through a Go context and the runner force-terminates its owned process group after the cleanup grace period. Communicate results on a dedicated temporary report file so application stdout cannot forge or corrupt the report. Protocol 1 carries exactly one `{id,status,diagnostic?}` per selected ID; reject duplicates, unknown IDs, missing records, invalid protocol/status and malformed/oversized JSON. Read reports only after child termination. A nonzero exit, compile error, panic, spawn error, cancelled run or missing report cannot produce PASS even if partial output exists. Successful per-target records are necessary, not an exit-code substitute. Bound input/report/stdout/stderr to 4 MB and surfaced diagnostics to 8,000 characters, consistent with existing direct execution. Propagate cancellation, terminate the child process tree if necessary and remove temporary bridge/report paths in a finally block. Go build cache is toolchain-owned and may remain; no per-project compiled helper is retained.


Alternative rejected: generate one `TestName` per scenario and use the ordinary Go runner. It makes ID encoding/subtest matching fragile and introduces a second test registration contract. Also rejected: run a consumer catalog command for discovery, because it executes `init` and forces application code into inspection.

### 5. Same account, separate language consumers

Move authored files from `examples/scenarios/` into `examples/scenarios/typescript/`: `package.json`, `demo.mjs`, `src/account.mjs`, `specifications/account.scenarios.mjs`, `specifications/account.driver.mjs`, `test/account.node.mjs`, `.focused-spec/config.yaml`. Adjust package `file:` dependencies by one parent level. Preserve the optional test-wrapper comment. Ignore generated node_modules/caches; they are not authored migration targets. Do not add forwarding commands at the parent.

Create the Go consumer with `go.mod`, `bank/account.go`, `specifications/account.scenarios.go`, `specifications/account.driver.go`, `specifications/account_test.go`, `cmd/demo/main.go`, `package.json` for optional npm plugin dependencies, and `.focused-spec/config.yaml`. The Go module requires the SDK with a documented repository-local replacement `../../../packages/sdk/go` for checkout commands. Isolated distribution checks copy the SDK to a separate temporary distribution and write their own replacement; they must not retain a path into this checkout. Plugin npm dependencies use `../../../packages/...`. No Node requirement for `go test ./...` or `go run ./cmd/demo`.

Keep IDs and meanings: `account.open`, `account.deposit`, `account.withdraw.history`, `account.withdraw.entire-balance`, `account.withdraw.insufficient-funds`, `account.withdraw.after-decline`. Use integer cents, explicit event/command types, complete event-history replay, new-event-only observations and declined withdrawals that do not consume funds. Ordinary tests loop over the same suite; their registration wrapper adds no behavior. Demo prints Given/When/Expect/Actual and per-scenario result, returning nonzero on failure.

### 6. Exact repository evidence plan

Apply creates `.focused-spec/evidence/go-executable-scenarios.yaml` with `scopes.add-go-executable-scenarios`. For each row below its key is the native ID and its value is `{evidence: [reference]}`. References are concrete only after the named assertion exists. All new tests use describe block `Go executable scenarios` in `test/go-executable-scenarios.spec.ts`:

| Native ID | Exact reference |
| --- | --- |
| `go-sdk.independent` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes the Go SDK without Node dependencies` |
| `go-sdk.invalid-declaration` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > rejects invalid Go declarations before preparation` |
| `go-sdk.comparison` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > reports real Go observation mismatches` |
| `go-sdk.input-isolation` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > preserves Go declarations against driver mutation` |
| `go-sdk.cleanup` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > preserves primary and cleanup failures` |
| `go-sdk.cancellation` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > releases prepared resources after cancellation` |
| `go-format.static-discovery` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > inspects Go scenarios without running initializers` |
| `go-format.dynamic-rejected` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > rejects dynamic Go scenarios without evaluation` |
| `go-format.direct-enrollment` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes native Go scenarios without a registry` |
| `go-runner.exact-selection` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes only the exact selected Go identity` |
| `go-runner.missing-target` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > rejects a removed Go target` |
| `go-runner.transport` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > rejects a missing selected execution report` |
| `go-runner.containment` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > rejects escaped Go driver sources without execution` |
| `go-distribution.consumer` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > runs distributed Go assets outside the checkout` |
| `go-example.typescript-move` | `vitest::test/executable-scenarios.spec.ts::executable scenarios > detects the bank withdrawal boundary regression` |
| `go-example.bank` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > detects the Go bank withdrawal boundary regression` |

The five SDK edge tests can invoke narrow native Go tests or isolated consumer programs, but must inspect their behavioral failures, not merely echo fields or inspect source. Ordinary standalone Go tests belong in the module. Existing `.focused-spec/evidence/executable-scenarios.yaml` remains unchanged because its selected assertion and outcome survive the fixture relocation. New bindings do not enroll the Go bank outcomes as duplicate Markdown; they describe SDK/integration behavior, while the consumer's bank code scenarios remain its canonical domain source.

### 7. Distribution, documentation and verification

Update root `package.json`/`package-lock.json`, new plugin manifests/tsconfigs, `scripts/stage-assets.mjs`, package build asset handling and `test/package.spec.ts` package inventory only where affected. npm workspace glob ignores the Go module without a `package.json`; do not manufacture one. Build both plugins after core; format before runner. Stage LICENSE and runner README from existing owners. SDK README and format README are authored public contracts.

Documentation edits: `README.md`; `docs/README.md`; `docs/guides/README.md`; `docs/guides/configuration.md`; `docs/guides/runners.md`; `docs/guides/install.md`; `docs/development/README.md`; `docs/development/workflow.md`; `docs/development/releasing.md`; `packages/sdk/go/README.md`; `packages/formats/scenarios-go/README.md`. Use existing owning pages rather than add another scenario workflow guide. Link the new SDK/format public contracts from indexes. Generated runner READMEs are not authored separately.

Apply acceptance runs native SDK tests; both standalone consumers; installed CLI list/show/syntax-only/strict/one-ID/all for both roots; clean-consumer module/plugin execution; `npm test`; strict focused validation and execution of the new scope. Prove each new evidence assertion is sensitive to a controlled product regression and restore it, not a test/selector change. Bank mutations replace the overdraft `>` boundary with `>=` in disposable copies, observe assertion failure through both paths, restore and observe PASS. Record actual results and runtime versions under `.eval-cache/go-executable-scenarios-verification.json`; explicitly distinguish tested Go 1.26.1 from the declared 1.23 baseline unless 1.23 is actually exercised. No optional skip may certify Go support. Validate documentation links and indexes; no agent-eval matrix is needed.

## Risks / Trade-offs

- Restricted grammar rejects valid dynamic Go → explain the static subset; SDK-only dynamic use remains valid. Never silently omit it.
- Discovery needs Go even for list → only the optional Go format has this prerequisite; core and TypeScript consumers remain unchanged. First helper build can be slow; use Go's normal build cache, not a custom cache protocol.
- Runtime suite values can differ from parsed source if trusted code mutates globals → recheck exact ID and declaration metadata in the bridge; a missing identity fails. No sandbox or immutable-global claim.
- Consumer `init` runs during Go execution → document it; selected action isolation does not mean import-side-effect isolation. Inspection must still remain side-effect-free.
- Build constraints and external-test packages complicate importability → reject constrained scenario files and `_test.go` declarations for this native format; ordinary Go test wrappers remain unrestricted.
- Unsynced earlier capability contains an obsolete single-root requirement → record this dependency now and reconcile during an explicitly authorized future sync, not by changing historical evidence or silently publishing both contracts.
- Versioned Go module is not yet published → verify distribution through a copied module and an explicit replacement; do not claim `go get @latest` is tested.

## Migration Plan

Implement SDK and language plugins, move the TypeScript consumer with all active callers, add the Go consumer, then integrate capability evidence and documentation. Keep both consumers executable throughout completed verification. Rollback, if requested, restores only this change's additions and the authored TypeScript move; no reset of unrelated work. Sync/archive and module/npm publication require separate authorization.
