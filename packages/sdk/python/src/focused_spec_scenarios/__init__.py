"""Independent executable Given/When/Expect scenarios for Python."""

from __future__ import annotations

import asyncio
import copy
import keyword
import math
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

Given = TypeVar("Given")
When = TypeVar("When")
Expect = TypeVar("Expect")
Subject = TypeVar("Subject")


@dataclass(frozen=True, slots=True)
class Scenario(Generic[Given, When, Expect]):
    id: str
    name: str
    given: Given
    when: When
    expect: Expect

@dataclass(frozen=True, slots=True)
class DriverBinding:
    """Inert source metadata for optional focused-spec integration."""

    path: str
    export: str


@dataclass(frozen=True, slots=True)
class Suite(Generic[Given, When, Expect]):
    scenarios: tuple[Scenario[Given, When, Expect], ...]
    driver: DriverBinding | None = None


@dataclass(frozen=True, slots=True)
class ExecutionEvent:
    kind: str
    name: str | None = None
    value: Any = None
    message: str | None = None
    data: Any = None


@dataclass(frozen=True, slots=True)
class DriverContext:
    scenario_id: str
    explain: Callable[[str, Any], None]


@dataclass(frozen=True, slots=True)
class Driver(Generic[Subject, Given, When, Expect]):
    given: Callable[[Given, DriverContext], Subject | Awaitable[Subject]]
    when: Callable[[Subject, When, DriverContext], Expect | Awaitable[Expect]]
    cleanup: Callable[[Subject, DriverContext], None | Awaitable[None]] | None = None


class ScenarioMismatch(AssertionError):
    def __init__(self, scenario: Scenario[Any, Any, Any], expected: Any, actual: Any) -> None:
        self.scenario_id = scenario.id
        self.scenario_name = scenario.name
        self.expected = copy.deepcopy(expected)
        self.actual = copy.deepcopy(actual)
        super().__init__(f"{scenario.id}: {scenario.name}: expected {self.expected!r}, actual {self.actual!r}")


class ScenarioCancelled(asyncio.CancelledError):
    """Raised when cancellation prevents a scenario from producing a pass."""


def _valid_id(value: str) -> bool:
    return bool(value.strip()) and not any(ord(char) < 32 or 127 <= ord(char) < 160 for char in value)


def _validate_data(value: Any, label: str, ancestors: set[int] | None = None) -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise TypeError(f"{label} contains a non-finite number")
        return
    if not isinstance(value, (list, tuple, dict)):
        raise TypeError(f"{label} contains unsupported {type(value).__name__}")
    seen = ancestors if ancestors is not None else set()
    identity = id(value)
    if identity in seen:
        raise TypeError(f"{label} contains a cycle")
    seen.add(identity)
    try:
        if isinstance(value, dict):
            for key, item in value.items():
                if not isinstance(key, str):
                    raise TypeError(f"{label} has a non-string mapping key")
                _validate_data(item, f"{label}.{key}", seen)
        else:
            for index, item in enumerate(value):
                _validate_data(item, f"{label}[{index}]", seen)
    finally:
        seen.remove(identity)


def validate_scenario(scenario: Scenario[Any, Any, Any]) -> None:
    if not isinstance(scenario, Scenario):
        raise TypeError("scenario must be a Scenario instance")
    if not _valid_id(scenario.id):
        raise ValueError("scenario ID must contain non-whitespace and no control characters")
    if not scenario.name.strip():
        raise ValueError("scenario name must be nonblank")
    _validate_data(scenario.given, f"{scenario.id} Given")
    _validate_data(scenario.when, f"{scenario.id} When")
    _validate_data(scenario.expect, f"{scenario.id} Expect")


def define_suite(
    *scenarios: Scenario[Given, When, Expect],
    driver: DriverBinding | None = None,
) -> Suite[Given, When, Expect]:
    if not scenarios:
        raise ValueError("suite must contain at least one scenario")
    if driver is not None:
        if not isinstance(driver, DriverBinding):
            raise TypeError("suite driver must be a DriverBinding")
        if not isinstance(driver.path, str) or not driver.path.strip() or any(
            ord(char) < 32 or 127 <= ord(char) < 160 for char in driver.path
        ):
            raise ValueError("suite driver path must be nonblank and contain no control characters")
        if not isinstance(driver.export, str) or not driver.export.isidentifier() or keyword.iskeyword(driver.export):
            raise ValueError("suite driver export must be a Python identifier")
    identities: set[str] = set()
    for scenario in scenarios:
        validate_scenario(scenario)
        if scenario.id in identities:
            raise ValueError(f"duplicate scenario ID: {scenario.id}")
        identities.add(scenario.id)
    return Suite(tuple(scenarios), driver)


def _equal(left: Any, right: Any) -> bool:
    if type(left) is not type(right):
        return False
    if isinstance(left, float) and math.isnan(left):
        return isinstance(right, float) and math.isnan(right)
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(_equal(left[key], right[key]) for key in left)
    if isinstance(left, (list, tuple)):
        return len(left) == len(right) and all(_equal(a, b) for a, b in zip(left, right))
    return left == right


def _await(value: Any) -> Any:
    if not hasattr(value, "__await__"):
        return value
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(value)
    raise RuntimeError("async driver operations require verify_specification_async")


def verify_specification(
    driver: Driver[Subject, Given, When, Expect],
    scenario: Scenario[Given, When, Expect],
    *,
    on_event: Callable[[ExecutionEvent], None] | None = None,
    cancelled: Callable[[], bool] | None = None,
) -> Expect:
    return _await(verify_specification_async(driver, scenario, on_event=on_event, cancelled=cancelled))


async def verify_specification_async(
    driver: Driver[Subject, Given, When, Expect],
    scenario: Scenario[Given, When, Expect],
    *,
    on_event: Callable[[ExecutionEvent], None] | None = None,
    cancelled: Callable[[], bool] | None = None,
) -> Expect:
    validate_scenario(scenario)
    if not callable(driver.given) or not callable(driver.when):
        raise TypeError("driver requires callable given and when operations")
    if driver.cleanup is not None and not callable(driver.cleanup):
        raise TypeError("driver cleanup must be callable")

    def check_cancelled() -> None:
        if cancelled is not None and cancelled():
            raise ScenarioCancelled(f"{scenario.id}: execution cancelled")

    def emit(event: ExecutionEvent) -> None:
        if on_event is not None:
            on_event(copy.deepcopy(event))

    def explain(message: str, data: Any = None) -> None:
        if not isinstance(message, str) or not message.strip():
            raise ValueError("explanation message must be nonblank")
        if on_event is not None:
            if data is not None:
                _validate_data(data, "explanation data")
            emit(ExecutionEvent("explanation", message=message, data=data))

    check_cancelled()
    context = DriverContext(scenario.id, explain)
    inputs = copy.deepcopy((scenario.given, scenario.when))
    emit(ExecutionEvent("observation", name="Given", value=scenario.given))
    emit(ExecutionEvent("observation", name="When", value=scenario.when))
    emit(ExecutionEvent("observation", name="Expect", value=scenario.expect))
    subject = await _resolve(driver.given(inputs[0], context))
    primary: BaseException | None = None
    actual: Any = None
    try:
        check_cancelled()
        actual = await _resolve(driver.when(subject, inputs[1], context))
        check_cancelled()
        _validate_data(actual, f"{scenario.id} Actual")
        emit(ExecutionEvent("observation", name="Actual", value=actual))
        if not _equal(actual, scenario.expect):
            raise ScenarioMismatch(scenario, scenario.expect, actual)
    except BaseException as error:
        primary = error
    cleanup_error: BaseException | None = None
    if driver.cleanup is not None:
        try:
            await _resolve(driver.cleanup(subject, context))
        except BaseException as error:
            cleanup_error = error
    if primary is not None and cleanup_error is not None:
        raise BaseExceptionGroup(f"{scenario.id}: execution and cleanup failed", [primary, cleanup_error])
    if primary is not None:
        raise primary
    if cleanup_error is not None:
        raise cleanup_error
    return copy.deepcopy(actual)


async def _resolve(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value


__all__ = [
    "Driver",
    "DriverBinding",
    "DriverContext",
    "ExecutionEvent",
    "Scenario",
    "ScenarioCancelled",
    "ScenarioMismatch",
    "Suite",
    "define_suite",
    "validate_scenario",
    "verify_specification",
    "verify_specification_async",
]
