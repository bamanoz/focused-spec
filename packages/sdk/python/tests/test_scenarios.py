import asyncio

import pytest

from focused_spec_scenarios import (
    Driver,
    DriverContext,
    ExecutionEvent,
    Scenario,
    ScenarioCancelled,
    ScenarioMismatch,
    define_suite,
    verify_specification,
    verify_specification_async,
)


def test_real_driver_result_is_compared_exactly() -> None:
    scenario = Scenario("deposit", "Deposit", {"balance": 100}, 25, {"balance": 125})
    driver = Driver(lambda given, _: given, lambda subject, amount, _: {"balance": subject["balance"] + amount})
    assert verify_specification(driver, scenario) == {"balance": 125}
    with pytest.raises(ScenarioMismatch) as mismatch:
        verify_specification(Driver(lambda given, _: given, lambda subject, amount, _: {"balance": 124}), scenario)
    assert mismatch.value.scenario_id == "deposit"
    assert mismatch.value.expected == {"balance": 125}
    assert mismatch.value.actual == {"balance": 124}


def test_validation_rejects_bad_identity_duplicate_ids_and_cycles_before_driver() -> None:
    driver = Driver(lambda value, _: called_set(value), lambda subject, value, _: value)
    cycle: list[object] = []
    cycle.append(cycle)
    with pytest.raises(ValueError):
        verify_specification(driver, Scenario("\n", "bad", 0, 0, 0))
    with pytest.raises(TypeError, match="cycle"):
        define_suite(Scenario("cycle", "cycle", cycle, 0, 0))
    valid = Scenario("same", "first", 0, 0, 0)
    with pytest.raises(ValueError, match="duplicate"):
        define_suite(valid, Scenario("same", "second", 0, 0, 0))
    with pytest.raises(TypeError):
        Scenario(id="missing", name="Missing Expect", given=0, when=0)
    with pytest.raises(TypeError):
        Scenario(id="extra", name="Extra field", given=0, when=0, expect=0, unsupported=1)
    with pytest.raises(TypeError, match="unsupported"):
        verify_specification(driver, Scenario("unsupported", "Unsupported", {1, 2}, 0, 0))


def called_set(value: object) -> object:
    raise AssertionError(f"driver ran during invalid declaration: {value!r}")


def test_driver_mutation_does_not_rewrite_declaration_or_expectation() -> None:
    given = {"items": [1]}
    expected = {"items": [1]}
    scenario = Scenario("isolation", "Isolated values", given, 0, expected)

    def prepare(value: dict[str, list[int]], _: object) -> dict[str, list[int]]:
        value["items"].append(2)
        return value

    def act(subject: dict[str, list[int]], _: int, __: object) -> dict[str, list[int]]:
        subject["items"][0] = 9
        return subject

    with pytest.raises(ScenarioMismatch):
        verify_specification(Driver(prepare, act), scenario)
    assert scenario.given == {"items": [1]}
    assert scenario.expect == {"items": [1]}


def test_cleanup_runs_once_and_preserves_both_failures() -> None:
    calls: list[str] = []
    scenario = Scenario("cleanup", "Cleanup errors", 1, 2, 3)

    def cleanup(_: int, __: object) -> None:
        calls.append("cleanup")
        raise LookupError("release")

    with pytest.raises(ExceptionGroup) as result:
        verify_specification(Driver(lambda value, _: value, lambda subject, _, __: 4, cleanup), scenario)
    assert len(result.value.exceptions) == 2
    assert isinstance(result.value.exceptions[0], ScenarioMismatch)
    assert isinstance(result.value.exceptions[1], LookupError)
    assert calls == ["cleanup"]


def test_cancellation_and_cleanup_failure_remain_discoverable() -> None:
    def act(subject: int, amount: int, _: object) -> int:
        raise ScenarioCancelled("cancelled")

    def cleanup(subject: int, _: object) -> None:
        raise LookupError("release")

    with pytest.raises(BaseExceptionGroup) as result:
        verify_specification(Driver(lambda value, _: value, act, cleanup), Scenario("both", "Both errors", 1, 2, 3))
    assert isinstance(result.value.exceptions[0], ScenarioCancelled)
    assert isinstance(result.value.exceptions[1], LookupError)


def test_cancellation_still_releases_prepared_subject() -> None:
    released: list[int] = []
    scenario = Scenario("cancel", "Cancellation", 5, 1, 4)
    cancelled = False

    async def cancel_action(subject: int, amount: int, _: object) -> int:
        nonlocal cancelled
        cancelled = True
        return subject - amount

    async def cleanup(subject: int, _: object) -> None:
        await asyncio.sleep(0)
        released.append(subject)

    driver = Driver(lambda value, _: value, cancel_action, cleanup)
    with pytest.raises(ScenarioCancelled):
        asyncio.run(verify_specification_async(driver, scenario, cancelled=lambda: cancelled))
    assert released == [5]


def test_optional_events_are_ordered_and_mismatch_keeps_actual() -> None:
    events: list[ExecutionEvent] = []
    scenario = Scenario("events", "Events", {"x": 1}, 2, {"y": 3})
    driver = Driver(
        lambda value, _: value,
        lambda subject, amount, context: (context.explain("computed", {"amount": amount}) or {"y": 4}),
    )
    with pytest.raises(ScenarioMismatch):
        verify_specification(driver, scenario, on_event=events.append)
    assert [(event.kind, event.name, event.message) for event in events] == [
        ("observation", "Given", None),
        ("observation", "When", None),
        ("observation", "Expect", None),
        ("explanation", None, "computed"),
        ("observation", "Actual", None),
    ]
    assert events[-1].value == {"y": 4}
    events[0].value["x"] = 9
    assert scenario.given == {"x": 1}


def test_async_driver_operations_are_awaited() -> None:
    scenario = Scenario("async", "Async operations", 2, 3, 5)

    async def prepare(value: int, _: object) -> int:
        await asyncio.sleep(0)
        return value

    async def act(subject: int, value: int, _: object) -> int:
        await asyncio.sleep(0)
        return subject + value

    assert asyncio.run(verify_specification_async(Driver(prepare, act), scenario)) == 5


def test_actual_snapshot_precedes_cleanup() -> None:
    scenario = Scenario("snapshot", "Snapshot", 1, 2, {"value": 3})
    actual = {"value": 3}

    def cleanup(_: int, __: object) -> None:
        actual["value"] = 9

    driver = Driver(lambda value, _: value, lambda _subject, _when, _: actual, cleanup)
    assert verify_specification(driver, scenario) == {"value": 3}
    assert actual == {"value": 9}
    actual["value"] = 4
    with pytest.raises(ScenarioMismatch) as mismatch:
        verify_specification(driver, scenario)
    assert mismatch.value.expected == {"value": 3}
    assert mismatch.value.actual == {"value": 4}
    assert actual == {"value": 9}


def test_async_actual_snapshot_precedes_cleanup() -> None:
    scenario = Scenario("async-snapshot", "Async snapshot", 1, 2, {"value": 3})
    actual = {"value": 3}

    async def cleanup(_: int, __: object) -> None:
        actual["value"] = 9

    async def run() -> None:
        driver = Driver(lambda value, _: value, lambda _subject, _when, _: actual, cleanup)
        assert await verify_specification_async(driver, scenario) == {"value": 3}
        actual["value"] = 4
        with pytest.raises(ScenarioMismatch) as mismatch:
            await verify_specification_async(driver, scenario)
        assert mismatch.value.expected == {"value": 3}
        assert mismatch.value.actual == {"value": 4}

    asyncio.run(run())
    assert actual == {"value": 9}

def test_sync_verification_inside_running_loop() -> None:
    async def run() -> None:
        scenario = Scenario("in-loop", "Synchronous in loop", 2, 3, 5)
        driver = Driver(lambda value, _: value, lambda subject, amount, _: subject + amount)
        assert verify_specification(driver, scenario) == 5

    asyncio.run(run())


def test_sync_verification_rejects_awaitables_without_warning() -> None:
    import gc
    import warnings

    async def operation(*args: object) -> int:
        return 1

    scenario = Scenario("awaitable", "Awaitable", 1, 2, 1)
    for stage in ("given", "when", "cleanup"):
        released: list[int] = []

        def cleanup(subject: int, _: object) -> object:
            released.append(subject)
            return operation() if stage == "cleanup" else None

        driver = Driver(
            operation if stage == "given" else lambda value, _: value,
            operation if stage == "when" else lambda subject, _, __: subject,
            cleanup,
        )
        with warnings.catch_warnings(record=True) as warnings_seen:
            warnings.simplefilter("always")
            with pytest.raises(RuntimeError, match="verify_specification_async"):
                verify_specification(driver, scenario)
            gc.collect()
        assert released == ([] if stage == "given" else [1])
        assert not [warning for warning in warnings_seen if issubclass(warning.category, RuntimeWarning)]


def test_cooperative_cancellation_is_task_group_failure() -> None:
    released: list[int] = []

    async def run() -> None:
        cancelled = False

        async def act(subject: int, _: int, __: object) -> int:
            nonlocal cancelled
            cancelled = True
            return subject

        async def cleanup(subject: int, _: object) -> None:
            await asyncio.sleep(0)
            released.append(subject)

        async with asyncio.TaskGroup() as group:
            group.create_task(verify_specification_async(
                Driver(lambda value, _: value, act, cleanup),
                Scenario("group-cancel", "Group cancellation", 1, 2, 1),
                cancelled=lambda: cancelled,
            ))

    with pytest.raises(ExceptionGroup) as result:
        asyncio.run(run())
    assert isinstance(result.value.exceptions[0], ScenarioCancelled)
    assert released == [1]


def test_native_task_cancellation_runs_cleanup() -> None:
    released: list[int] = []
    started = asyncio.Event()

    async def run() -> None:
        async def act(subject: int, _: int, __: object) -> int:
            started.set()
            await asyncio.sleep(10)
            return subject

        async def cleanup(subject: int, _: object) -> None:
            released.append(subject)

        task = asyncio.create_task(verify_specification_async(
            Driver(lambda value, _: value, act, cleanup), Scenario("task-cancel", "Task cancellation", 5, 1, 5)
        ))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    assert released == [5]


def test_explain_validates_without_observer(capsys: pytest.CaptureFixture[str]) -> None:
    scenario = Scenario("explain-validation", "Explain validation", 1, 2, 3)
    for observed in (False, True):
        events: list[ExecutionEvent] = []

        def bad_message(_: int, __: int, context: DriverContext) -> int:
            context.explain(" ")
            return 3

        with pytest.raises(ValueError, match="message"):
            verify_specification(Driver(lambda value, _: value, bad_message), scenario, on_event=events.append if observed else None)

        def bad_data(_: int, __: int, context: DriverContext) -> int:
            context.explain("bad data", {1, 2})
            return 3

        with pytest.raises(TypeError, match="unsupported"):
            verify_specification(Driver(lambda value, _: value, bad_data), scenario, on_event=events.append if observed else None)
        assert all(event.kind != "explanation" for event in events)

    def valid(_: int, __: int, context: DriverContext) -> int:
        context.explain("valid", {"count": 1})
        return 3

    assert verify_specification(Driver(lambda value, _: value, valid), scenario) == 3
    assert capsys.readouterr() == ("", "")


def test_explain_data_is_optional() -> None:
    context = DriverContext("typing", lambda _message, _data=None: None)
    context.explain("message")
