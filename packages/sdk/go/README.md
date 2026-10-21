# focused-spec Go scenarios

Typed, dependency-free Given/When/Expect scenarios for Go 1.23 and later. This module uses only the Go standard library. Running a specification does not require Node.js, npm, focused-spec, OpenSpec, or a test framework; optional discovery and focused execution are separate plugins.

## Install the module

Create a Go consumer and install the SDK at the coordinated CLI/SDK release version:

```sh
mkdir scenario-consumer
cd scenario-consumer
go mod init example.com/scenario-consumer
go get github.com/bamanoz/focused-spec/packages/sdk/go@v0.10.1
```

The Go module has its own `packages/sdk/go/vX.Y.Z` tag, with the same version as the CLI and other SDKs. Repository examples retain an explicit repository-relative replacement to test checkout source without requiring a registry release.

## Runnable standalone example

Save this as `main.go` in the module created above, then run `go run .`:

```go
package main

import (
    "context"
    "fmt"
    "log"

    scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
)

type Account struct {
    Balance int64
}

type Deposit struct {
    Cents int64
}

type Observation struct {
    Balance int64
}

var AccountDriver = scenarios.Driver[*Account, int64, Deposit, Observation]{
    Given: func(ctx context.Context, balance int64) (*Account, error) {
        if err := ctx.Err(); err != nil {
            return nil, err
        }
        return &Account{Balance: balance}, nil
    },
    When: func(ctx context.Context, account *Account, command Deposit) (Observation, error) {
        if err := ctx.Err(); err != nil {
            return Observation{}, err
        }
        account.Balance += command.Cents
        return Observation{Balance: account.Balance}, nil
    },
}

var AccountSpecifications = scenarios.Suite[int64, Deposit, Observation]{
    Driver: scenarios.DriverBinding{Path: "main.go", Export: "AccountDriver"},
    Scenarios: []scenarios.Scenario[int64, Deposit, Observation]{
        {
            ID:     "account.deposit",
            Name:   "A deposit increases the balance",
            Given:  100,
            When:   Deposit{Cents: 25},
            Expect: Observation{Balance: 125},
        },
    },
}

func main() {
    if err := scenarios.ValidateSuite(AccountSpecifications); err != nil {
        log.Fatal(err)
    }
    actual, err := scenarios.VerifySpecification(
        context.Background(),
        AccountDriver,
        AccountSpecifications.Scenarios[0],
    )
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("actual: %+v\n", actual)
}
```

Expected output:

```text
actual: {Balance:125}
```

An ordinary Go test can loop over the same `Suite.Scenarios` and call `VerifySpecification`; the wrapper adds no scenario behavior.

## Public API

```go
type Scenario[Given, When, Expect any] struct {
    ID     string
    Name   string
    Given  Given
    When   When
    Expect Expect
}

type DriverBinding struct {
    Path   string
    Export string
}

type Suite[Given, When, Expect any] struct {
    Driver    DriverBinding
    Scenarios []Scenario[Given, When, Expect]
}

type Driver[Subject, Given, When, Expect any] struct {
    Given   func(context.Context, Given) (Subject, error)
    When    func(context.Context, Subject, When) (Expect, error)
    Cleanup func(context.Context, Subject) error // optional
}

type ExecutionEvent interface { /* sealed by this package */ }
type ObservationEvent struct { Kind, Name string; Value any }
type TextObservationEvent struct { Kind, Name, Text string }
type ExplanationEvent struct { Kind, Message string; Data any }
type TruncatedEvent struct { Kind, Message string }

func WithEvents(context.Context, func(ExecutionEvent)) context.Context
func Explain(context.Context, string, any)

func ValidateScenario[Given, When, Expect any](Scenario[Given, When, Expect]) error
func ValidateSuite[Given, When, Expect any](Suite[Given, When, Expect]) error
func VerifySpecification[Subject, Given, When, Expect any](
    context.Context,
    Driver[Subject, Given, When, Expect],
    Scenario[Given, When, Expect],
) (Expect, error)
```

`MismatchError` is returned for an unequal observation. It exposes `ScenarioID`, `ScenarioName`, `Expected`, and `Actual`; use `errors.As` to inspect it. The returned actual value and both error observations are snapshots taken before cleanup can mutate application state.

`DriverBinding` is inert integration metadata. Validation checks that `Path` is nonblank and control-free and that `Export` is an exported Go identifier, but the SDK never imports that path. Standalone callers always pass the real typed `Driver` directly.

## Declarations and supported data

Scenario IDs are exact opaque strings containing non-whitespace and no control characters. Case, Unicode, spaces, punctuation, and separators are not normalized. Names must be nonblank. `ValidateSuite` also rejects duplicate IDs and invalid driver metadata.

Given, When, Expect, and the actual observation are recursively data-only:

- booleans, strings, finite integer, floating-point, and complex values;
- arrays and slices, including nil slices;
- maps with recursively supported comparable keys and supported values;
- structs containing only exported data fields;
- interfaces and ordinary pointers containing supported data, including nil values.

Functions, channels, unsafe pointers, cycles, nonfinite numeric values, structs with unexported state, and values defining standard custom marshal hooks are rejected. Validation inspects types and values directly; it never invokes marshal methods or converts domain values through JSON.

Go cannot distinguish an omitted struct field from an explicitly authored zero value at runtime. `ValidateScenario` therefore accepts intentionally constructed zero values. The optional static Go format has a stricter source grammar and requires all five scenario fields to appear; a dynamically valid SDK declaration is not necessarily statically discoverable.

## Exact execution and input isolation

`VerifySpecification` validates the complete scenario before calling `Driver.Given`. Given and When are recursively cloned before preparation, retaining their concrete Go types and nil values. Driver mutation cannot rewrite the reusable declaration or an aliased Expect value.

The actual observation is validated and compared with Expect using `reflect.DeepEqual`. Equality is exact: nil and empty collections differ, numeric types remain distinct, struct fields and collection order matter, and there are no wildcard matchers or serialization coercions.

## Optional execution events

Derive an execution context with `WithEvents` to receive one synchronous, execution-local stream:

```go
var events []scenarios.ExecutionEvent
ctx := scenarios.WithEvents(context.Background(), func(event scenarios.ExecutionEvent) {
    events = append(events, event)
})
actual, err := scenarios.VerifySpecification(ctx, driver, scenario)
```

After declaration, driver and cancellation preconditions pass, verification emits isolated `Given`, `When` and `Expect` observations before preparation. A valid value returned by `When` emits `Actual` before exact comparison, so mismatches retain the real observation. An action error, cancellation or invalid result does not invent `Actual`. Drivers and application code may call `Explain(ctx, message, data)`; nil data is omitted. Explanation order follows the real preparation, action and cleanup calls.

Every emitted payload is an independent snapshot. Driver or cleanup mutation cannot rewrite an earlier event, and a sink that mutates its received value cannot rewrite the declaration, comparison value or another event. The SDK does not retain a hidden event list. Without a sink it performs no diagnostic cloning or representation work, `Explain` is a no-op, and no SDK output is written. A nil sink passed to `WithEvents` disables an inherited sink.

Observers run synchronously. A panic from a sink follows the ordinary panic and cleanup rules; it is not swallowed. Separate executions need separate sinks. A deliberately shared sink owns its synchronization and retention limits.

Portable observations use `ObservationEvent.Value` only when reflection can preserve the value in JSON: applicable exported struct-field JSON names are retained. Integers outside JavaScript's exact range, complex numbers, byte slices, non-string-keyed maps and other nonfaithful values use deterministic `TextObservationEvent.Text` instead. Explanation data uses the same fallback as a string. Representation never invokes `Stringer`, `GoStringer` or marshal hooks and does not affect typed `reflect.DeepEqual` verification. `TruncatedEvent` is available to bounded caller/runner collectors; the SDK observer itself is unbounded and caller-owned.

## Context and cleanup lifecycle

Every driver operation receives the caller's context. Cancellation is checked before preparation and before and after the action. Drivers must cooperate with cancellation while doing work.

After `Given` succeeds, optional `Cleanup` runs exactly once through a defer after success, action failure, mismatch, validation failure, cancellation, or panic unwinding. Cleanup receives `context.WithoutCancel(ctx)`, preserving context values while removing cancellation and deadlines so release remains possible. The driver remains responsible for giving cleanup its own time bound when needed. A failed `Given` owns any partially acquired resources and does not trigger SDK cleanup.

A cleanup error prevents success. If execution and cleanup both fail, the SDK uses `errors.Join`, so both remain discoverable with `errors.Is` or `errors.As`. Panics are not converted into success or ordinary errors; deferred cleanup runs while the original panic unwinds. Forced process termination cannot guarantee cleanup.
