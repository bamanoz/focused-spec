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

The expectation is authored independently of the driver. `verify_specification` executes synchronous operations inline, including when called from inside an already-running asyncio event loop. If an operation returns an awaitable, it closes a newly created coroutine where possible and raises `RuntimeError` directing the caller to `verify_specification_async`, without leaking an un-awaited-coroutine warning. `verify_specification_async` awaits synchronous or asynchronous operations and is the entry point for async drivers.

## Public API

`Scenario(id, name, given, when, expect)` declares one outcome. `define_suite(*scenarios, driver=None)` validates a nonempty suite and rejects duplicate IDs; the keyword-only `driver` accepts optional inert `DriverBinding(path, export)` metadata for native focused-spec discovery. The path is relative to the suite source and the export names one top-level driver value. Creating or verifying a suite never resolves or imports this binding. `Driver(given, when, cleanup=None)` binds application operations directly for standalone callers. The preparation operation receives Given and a `DriverContext`; the action receives the prepared subject, When, and that context. `verify_specification` and `verify_specification_async` accept optional `on_event` and `cancelled` callbacks.

IDs are exact, contain non-whitespace, and have no control characters. Names are nonblank. Scenario data is limited to null, booleans, strings, integers, finite floats, lists, tuples, and string-keyed dictionaries containing the same supported values. Cycles, non-string keys, sets, custom objects, and non-finite numbers are rejected before driver execution. Python annotations help static checking; runtime validation remains authoritative.
The published wheel and source distribution include `py.typed` and the SPDX `MIT` license expression, along with Python 3.11+ classifiers and repository/issue project URLs. After installation, typing tools can discover `focused_spec_scenarios/py.typed` through package resources.
Comparison is recursive and type-aware: `True` does not equal `1`, tuple and list differ, collection order matters, and missing keys differ from keys with `None`. Driver inputs are deep-copied from the reusable declaration. The validated actual result is snapshotted before cleanup and returned as that stable snapshot. `ScenarioMismatch` exposes scenario identity and independent expected/actual snapshots captured before cleanup.

## Cleanup, cancellation, and events

After preparation succeeds, optional cleanup runs once after success, action failure, mismatch, or cancellation. Failed preparation leaves partially acquired resources to the driver. Cleanup failure prevents success; simultaneous execution and cleanup failures remain grouped. Cooperative cancellation raises `ScenarioCancelled`, an ordinary `Exception` that remains visible to task groups; native `asyncio.CancelledError` propagates unchanged after cleanup. A matching observation after cancellation cannot pass.

An optional event observer receives execution-local `Given`, `When`, `Expect`, application explanations, and valid `Actual` observations in order. Values are copied when delivered. `explain` always validates that the message is nonblank and data is supported, whether or not an observer is configured; without an observer it emits no event, retains no event history, and writes no output. Events do not affect comparison or pass status.

`pytest` is a consumer-owned development/test dependency. The SDK itself does not provide pytest discovery and never depends on Node.js or focused-spec. Optional `@focused-spec/format-scenarios-python` and `@focused-spec/runner-scenarios-python` packages consume explicit `DriverBinding` metadata for direct native CLI discovery and execution. Existing unbound suites, pytest tests, and demos remain standalone. The maintained bank example demonstrates one canonical suite and driver shared by ordinary pytest tests, a readable demo, and optional focused execution.