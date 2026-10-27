# focused-spec-scenarios

Independent executable Given/When/Expect scenarios for Python 3.11+. The SDK uses only the Python standard library at runtime; it does not require focused-spec, OpenSpec, pytest, or another test framework.

## Install and execute

```sh
python -m pip install focused-spec-scenarios
```

```python
from focused_spec_scenarios import Driver, DriverBinding, Scenario, define_suite, verify_specification

scenario = Scenario(
    id="account.deposit",
    name="A deposit increases the balance",
    given={"balance": 100},
    when={"cents": 25},
    expect={"balance": 125},
)
driver = Driver(
    given=lambda initial, context: dict(initial),
    when=lambda account, command, context: {
        "balance": account["balance"] + command["cents"]
    },
)
suite = define_suite(
    scenario,
    driver=DriverBinding(path="account_driver.py", export="DRIVER"),
)
actual = verify_specification(driver, scenario)
assert actual == {"balance": 125}
```

The expectation is authored independently of the driver. `verify_specification` accepts synchronous drivers and returns the actual observation. `verify_specification_async` awaits synchronous or asynchronous operations and can be used directly from an existing asyncio event loop.

## Public API

`Scenario(id, name, given, when, expect)` declares one outcome. `define_suite(*scenarios, driver=None)` validates a nonempty suite and rejects duplicate IDs; the keyword-only `driver` accepts optional inert `DriverBinding(path, export)` metadata for native focused-spec discovery. The path is relative to the suite source and the export names one top-level driver value. Creating or verifying a suite never resolves or imports this binding. `Driver(given, when, cleanup=None)` binds application operations directly for standalone callers. The preparation operation receives Given and a `DriverContext`; the action receives the prepared subject, When, and that context. `verify_specification` and `verify_specification_async` accept optional `on_event` and `cancelled` callbacks.

IDs are exact, contain non-whitespace, and have no control characters. Names are nonblank. Scenario data is limited to null, booleans, strings, integers, finite floats, lists, tuples, and string-keyed dictionaries containing the same supported values. Cycles, non-string keys, sets, custom objects, and non-finite numbers are rejected before driver execution. Python annotations help static checking; runtime validation remains authoritative.

Comparison is recursive and type-aware: `True` does not equal `1`, tuple and list differ, collection order matters, and missing keys differ from keys with `None`. Driver inputs are deep-copied from the reusable declaration. `ScenarioMismatch` exposes scenario identity and independent expected/actual snapshots.

## Cleanup, cancellation, and events

After preparation succeeds, optional cleanup runs once after success, action failure, mismatch, or cancellation. Failed preparation leaves partially acquired resources to the driver. Cleanup failure prevents success; an execution and cleanup failure are both retained in an `ExceptionGroup` (`BaseExceptionGroup` when cancellation is a base exception). Cancellation is cooperative through the optional `cancelled` callback. A matching observation after cancellation cannot pass, and cleanup still runs.

An optional event observer receives execution-local `Given`, `When`, `Expect`, application explanations, and valid `Actual` observations in order. Values are copied when delivered. Events do not affect comparison or pass status. Without an observer the SDK retains no event history and writes no output.

`pytest` is a consumer-owned development/test dependency. The SDK itself does not provide pytest discovery and never depends on Node.js or focused-spec. Optional `@focused-spec/format-scenarios-python` and `@focused-spec/runner-scenarios-python` packages consume explicit `DriverBinding` metadata for direct native CLI discovery and execution. Existing unbound suites, pytest tests, and demos remain standalone. The maintained bank example demonstrates one canonical suite and driver shared by ordinary pytest tests, a readable demo, and optional focused execution.