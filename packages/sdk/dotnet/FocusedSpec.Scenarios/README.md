# FocusedSpec.Scenarios

Independent typed Given/When/Expect scenario execution for .NET 9 and later. The SDK has no focused-spec, OpenSpec, or xUnit runtime dependency.

## Install

Download the SDK `.nupkg` from the [GitHub Releases](https://github.com/bamanoz/focused-spec/releases/latest), add it to a project-local NuGet feed, and pin the matching package version in your project. It is not published on nuget.org; no Microsoft account is needed. Follow the [installation guide](../../../../docs/guides/install.md#net-sdk-from-github-releases) for download commands, checksum verification, configuration, and repeatable restore on other machines or CI.

## Declare and execute a scenario

```csharp
using FocusedSpec.Scenarios;

var scenario = new Scenario<int, int, int>(
    "account.deposit",
    "A deposit increases the balance",
    100,
    25,
    125);
var driver = new ScenarioDriver<int, int, int, int>
{
    Given = (balance, _) => ValueTask.FromResult(balance),
    When = (balance, cents, _) => ValueTask.FromResult(balance + cents),
};
var actual = await ScenarioExecutor.VerifyAsync(driver, scenario);
```

A driver exercises the real application boundary. Given, When, and Expect are explicit; the SDK does not derive Expect from execution.

Suites may carry an inert binding for optional focused-spec discovery without resolving or invoking the driver:

```csharp
var suite = new ScenarioSuite<int, int, int>(
    [scenario],
    new ScenarioDriverBinding("AccountScenarios.cs", "Example.AccountScenarios.Driver"));
```

`Path` is relative to the suite source. `Export` names a fully qualified public static field or parameterless property returning the suite's typed driver. The binding is optional; SDK-only callers continue to pass drivers directly to `ScenarioExecutor.VerifyAsync`.

## Public API

- `Scenario<TGiven,TWhen,TExpect>` stores exact `Id`, `Name`, `Given`, `When`, and `Expect` values.
- `ScenarioSuite<TGiven,TWhen,TExpect>` groups scenarios and optionally exposes inert `ScenarioDriverBinding` metadata. `ScenarioValidation.Validate` rejects empty suites, invalid identities/data, and duplicate IDs.
- `ScenarioDriver<TSubject,TGiven,TWhen,TExpect>` supplies asynchronous `Given` and `When` operations and optional asynchronous `Cleanup`.
- `ScenarioExecutor.VerifyAsync` validates before preparation, clones Given/When inputs, executes the driver, compares the actual result, and returns a snapshot. `ScenarioMismatchException` exposes scenario ID/name and stable Expected/Actual values.
- `DriverContext` provides scenario identity, the execution cancellation token, and `Explain(message, data?)`.
- `ExecutionEvent` records observations and explanations. Supply an observer to `VerifyAsync` to collect an execution-local ordered stream.

Data values are recursively validated before preparation. Comparison is typed and structural: runtime types, event order, nested fields, null and empty collections remain distinct. JSON serialization is not used as an equality oracle. Mutable input values, including nested record fields, are copied before driver calls while preserving their CLR types. Cycles, non-finite numbers, delegates, streams, tasks, and reflection type objects are unsupported.

Cleanup runs exactly once after successful preparation, including after action failure, mismatch, cancellation, or observer failure. It receives a context without caller cancellation. Failed preparation leaves partial-resource release to the driver. If execution and cleanup both fail, `AggregateException` retains both errors. Cancellation cannot turn matching output into success.

xUnit is a consumer-owned test dependency and calls the same `ScenarioExecutor` API; it is not required by this SDK package.