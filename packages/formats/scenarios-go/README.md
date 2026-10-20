# @focused-spec/format-scenarios-go

Optional native Go scenario discovery for focused-spec Format API 2. The plugin requires Node.js 22.16.0+ and a Go 1.23+ `go` executable on `PATH`. It has no npm SDK dependency: applications import the independent Go module `github.com/bamanoz/focused-spec/packages/sdk/go`.

## Installation and registration

Install the core, format, and runner npm packages. The Go SDK is a separate Go module and is not installed by npm. Until that module is published, repository and copied-distribution consumers must use an explicit `replace` to its local distribution.

```sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-go @focused-spec/runner-scenarios-go
```

```yaml
version: 5
specifications:
  formats:
    scenarios-go:
      package: '@focused-spec/format-scenarios-go'
      options: { runner: scenarios-go }
  documents:
    - match: 'specifications/**/*.scenarios.go'
      scope: current
      format: scenarios-go
runners:
  scenarios-go:
    package: '@focused-spec/runner-scenarios-go'
    timeoutMs: 120000
```

Format options are exactly `{ runner: '<registered runner ID>' }`. Each native scenario supplies one reference for that runner. No registry or Markdown companion is required.

## Supported native grammar

A `.scenarios.go` file has one non-`main` package, imports the SDK under its package name or a local alias, and declares one exported suite variable initialized by a literal `scenarios.Suite` composite:

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

Suite fields are exactly `Driver` and `Scenarios`. `Driver` is a literal `scenarios.DriverBinding` with exactly `Path` and `Export`. Scenario fields are exactly `ID`, `Name`, `Given`, `When`, and `Expect`, and all are required. IDs are exact, nonblank, control-free, and unique within the suite; Unicode, spaces, punctuation, slashes, quotes, and `::` are preserved. Names are nonblank. The catalog reports the real start line of each scenario composite.

Supported data consists of string and raw-string literals, integer and floating-point literals, booleans, `nil`, negative numeric literals, literal arrays and slices, keyed named-struct composites, and literal maps with string keys. Nested composites and identifiers, selectors, and generic instantiations in type positions are supported. Imports are parsed as inert syntax.

Discovery rejects build-constrained scenario files, `_test.go` scenario files, dot or blank SDK imports, missing or duplicate fields, duplicate IDs, extra declarations, functions and initializers, calls, constant references, concatenation, generated collections, address-taking, and other executable expressions. Unsupported dynamic suites remain valid for standalone SDK use but are not statically discoverable; they produce a source diagnostic rather than an empty catalog.

The driver binding is inert metadata. The driver source may contain ordinary application functions and arbitrary declarations. Static resolution uses `readDriver` to verify only that the named top-level exported variable exists in the parsed source and belongs to the expected package; it does not import, type-check, build, or execute that source.

## Static helper and limits

Discovery invokes the package's distributed `dist/go/catalog.go` helper with `go run`. The helper uses only `go/parser`, `go/ast`, `go/token`, and other Go standard-library packages. It parses the source supplied over JSON stdin rather than rereading the consumer file, and never imports or evaluates consumer code.

The distributed helper directory also contains its own `go.mod` boundary. Consumer commands such as `go test ./...` therefore ignore helper source under `node_modules`; helper invocation explicitly disables module mode and still builds only that standard-library source.

The helper runs from a fresh temporary directory with workspace and module resolution disabled, `GOTOOLCHAIN=local`, and network module lookup disabled. It therefore does not use the consumer's `go.mod`, `go.work`, replacements, or toolchain-download behavior. Input, stdout, and stderr are each limited to 4,000,000 bytes. Abort signals terminate the helper process group and its compiled child. A missing Go executable, parse failure, unsupported grammar, cancellation, process failure, malformed response, or output overflow is an explicit failure.

## Selectors and public catalog

Derived references use `<configured-runner>::<JSON tuple>`, where the tuple is `JSON.stringify([projectRelativeSuitePath, exactScenarioId])`:

```text
scenarios-go::["specifications/account.scenarios.go","account.withdraw.entire-balance"]
```

Only core's first `::` separates the runner ID. Suite paths must be contained project-relative `.scenarios.go` paths with no absolute path, traversal, empty component, backslash, or control character.

`@focused-spec/format-scenarios-go/catalog` exports:

```ts
interface Catalog {
  readonly suite: {
    readonly exportName: string
    readonly packageName: string
    readonly driver: { readonly path: string; readonly exportName: string }
  }
  readonly scenarios: readonly { readonly id: string; readonly name: string; readonly line: number }[]
}

readCatalog(path: string, source: string, signal?: AbortSignal): Promise<Catalog>
readDriver(path: string, source: string, exportName: string, signal?: AbortSignal): Promise<{ packageName: string }>
encodeSelector(path: string, id: string): string
decodeSelector(selector: string): readonly [string, string]
```

`CatalogError` carries a positive `line`. Both readers parse only the supplied source through the same bounded helper protocol. `readCatalog` owns the one static suite grammar; the official runner imports this API rather than maintaining another parser.

## Verify through the local CLI

```sh
./node_modules/.bin/focused-spec list
./node_modules/.bin/focused-spec show account.withdraw.entire-balance
./node_modules/.bin/focused-spec validate --syntax-only
./node_modules/.bin/focused-spec validate --strict
./node_modules/.bin/focused-spec run --scenario account.withdraw.entire-balance
```

List, show, syntax-only validation, and strict runner resolution do not execute consumer packages or initializers. Running selected evidence compiles and imports trusted consumer code, so its package initializers and dependencies may execute. Read the installed Go runner contract for runtime containment, report validation, cancellation, and cleanup limits.
