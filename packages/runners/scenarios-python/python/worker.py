#!/usr/bin/env python3
"""Runner-owned process for exact focused-spec Python scenario execution."""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
import json
import math
import os
import sys
import threading
import time
import traceback
from pathlib import Path
from types import ModuleType
from typing import Any

INPUT_LIMIT = 4_000_000
MAX_EVENTS = 256
MAX_EVENT_BYTES = 65_536
MAX_DIAGNOSTIC = 8_000
TRUNCATED = {"kind": "truncated", "message": "Additional execution events omitted"}


class RequestError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RequestError(message)


def contained(root: Path, value: object, label: str) -> Path:
    require(isinstance(value, str) and bool(value), f"{label} must be a path")
    path = Path(value).resolve(strict=True)
    try:
        path.relative_to(root)
    except ValueError as error:
        raise RequestError(f"{label} escapes the project") from error
    require(path.is_file(), f"{label} must be a file")
    return path


def load_module(path: Path, name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load Python source: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module


def load_project_module(root: Path, path: Path, fallback: str) -> ModuleType:
    relative = path.relative_to(root)
    parts = (*relative.parts[:-1], relative.stem)
    if parts and all(part.isidentifier() for part in parts):
        name = ".".join(parts)
        previous = sys.modules.get(name)
        previous_path = getattr(previous, "__file__", None)
        if previous is not None and (not isinstance(previous_path, str) or Path(previous_path).resolve(strict=True) != path):
            del sys.modules[name]
        module = importlib.import_module(name)
        module_path = getattr(module, "__file__", None)
        if not isinstance(module_path, str) or Path(module_path).resolve(strict=True) != path:
            raise ImportError(f"Python module did not resolve to selected source: {path}")
        return module
    return load_module(path, fallback)


def project(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if type(value) is int:
        if abs(value) > 9_007_199_254_740_991:
            return {"type": "python:int", "text": str(value)}
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise TypeError("non-finite Python number cannot be projected")
        return value
    if isinstance(value, list):
        return [project(item) for item in value]
    if isinstance(value, tuple):
        return {"type": "python:tuple", "items": [project(item) for item in value]}
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("Python mapping with a non-string key cannot be projected")
            result[key] = project(item)
        return result
    raise TypeError(f"unsupported Python event value: {type(value).__name__}")


class Events:
    def __init__(self) -> None:
        self.values: list[dict[str, Any]] = []
        self.bytes = 2
        self.stopped = False

    def retain(self, value: dict[str, Any]) -> None:
        if self.stopped:
            return
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
        marker = json.dumps(TRUNCATED, separators=(",", ":")).encode()
        separator = 0 if not self.values else 1
        if len(self.values) >= MAX_EVENTS - 1 or self.bytes + separator + len(encoded) + 1 + len(marker) > MAX_EVENT_BYTES:
            self.values.append(dict(TRUNCATED))
            self.stopped = True
            return
        self.values.append(value)
        self.bytes += separator + len(encoded)

    def emit(self, event: Any) -> None:
        kind = getattr(event, "kind", None)
        if kind == "observation":
            name = getattr(event, "name", None)
            require(isinstance(name, str) and bool(name.strip()), "invalid Python observation event")
            self.retain({"kind": kind, "message": name, "data": {"value": project(event.value)}})
            return
        if kind == "explanation":
            message = getattr(event, "message", None)
            require(isinstance(message, str) and bool(message.strip()), "invalid Python explanation event")
            data = getattr(event, "data", None)
            value = {"kind": kind, "message": message}
            if data is not None:
                value["data"] = project(data)
            self.retain(value)
            return
        raise TypeError(f"unsupported Python SDK execution event: {kind!r}")


def diagnostic(error: BaseException) -> str:
    rendered = "".join(traceback.format_exception(error)).strip()
    return rendered[-MAX_DIAGNOSTIC:]


def inventory(value: object) -> list[tuple[str, str]]:
    require(isinstance(value, list) and bool(value), "runtime inventory must be nonempty")
    result: list[tuple[str, str]] = []
    ids: set[str] = set()
    for entry in value:
        require(isinstance(entry, dict) and set(entry) == {"id", "name"}, "invalid runtime inventory entry")
        identity = entry.get("id")
        name = entry.get("name")
        require(isinstance(identity, str) and isinstance(name, str), "invalid runtime inventory identity")
        require(identity not in ids, "duplicate runtime inventory identity")
        ids.add(identity)
        result.append((identity, name))
    return result


def selected(value: object, known: set[str]) -> list[dict[str, str]]:
    require(isinstance(value, list) and bool(value), "selected execution must be nonempty")
    results: list[dict[str, str]] = []
    targets: set[str] = set()
    ids: set[str] = set()
    for entry in value:
        require(isinstance(entry, dict) and set(entry) == {"targetId", "id", "name"}, "invalid selected target")
        target_id = entry.get("targetId")
        identity = entry.get("id")
        name = entry.get("name")
        require(isinstance(target_id, str) and bool(target_id), "invalid selected target identity")
        require(isinstance(identity, str) and identity in known and isinstance(name, str), "unknown selected scenario")
        require(target_id not in targets and identity not in ids, "duplicate selected target")
        targets.add(target_id)
        ids.add(identity)
        results.append({"targetId": target_id, "id": identity, "name": name})
    return results


class Cancellation:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.requested = threading.Event()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.task: asyncio.Task[Any] | None = None
        self.thread = threading.Thread(target=self._watch, name="focused-spec-cancellation", daemon=True)

    def _watch(self) -> None:
        while not self.requested.is_set():
            if self.path.exists():
                self.requested.set()
                if self.loop is not None and self.task is not None:
                    self.loop.call_soon_threadsafe(self.task.cancel)
                return
            time.sleep(0.02)

    def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        current = asyncio.current_task()
        if current is None:
            raise RuntimeError("Python worker requires an asyncio task")
        self.task = current
        self.thread.start()

    def cancelled(self) -> bool:
        return self.requested.is_set()


async def execute(request: object) -> dict[str, object]:
    require(isinstance(request, dict), "worker request must be an object")
    expected = {
        "protocol", "nonce", "projectRoot", "suitePath", "suiteExport", "driverPath", "driverExport",
        "driverBinding", "inventory", "selected", "cancelPath",
    }
    require(set(request) == expected and request.get("protocol") == 1, "invalid worker request fields")
    nonce = request.get("nonce")
    suite_export = request.get("suiteExport")
    driver_export = request.get("driverExport")
    binding = request.get("driverBinding")
    require(isinstance(nonce, str) and bool(nonce), "worker request requires a nonce")
    require(isinstance(suite_export, str) and suite_export.isidentifier(), "invalid suite export")
    require(isinstance(driver_export, str) and driver_export.isidentifier(), "invalid driver export")
    require(isinstance(binding, dict) and set(binding) == {"path", "export"}
            and isinstance(binding.get("path"), str) and isinstance(binding.get("export"), str), "invalid driver binding")

    root_value = request.get("projectRoot")
    require(isinstance(root_value, str), "project root must be a path")
    root = Path(root_value).resolve(strict=True)
    require(root.is_dir(), "project root must be a directory")
    suite_path = contained(root, request.get("suitePath"), "suite source")
    driver_path = contained(root, request.get("driverPath"), "driver source")
    cancel_path_value = request.get("cancelPath")
    require(isinstance(cancel_path_value, str) and os.path.isabs(cancel_path_value), "invalid cancellation path")

    expected_inventory = inventory(request.get("inventory"))
    selection = selected(request.get("selected"), {identity for identity, _ in expected_inventory})
    cancellation = Cancellation(Path(cancel_path_value))
    cancellation.start()

    root_text = str(root)
    if root_text in sys.path:
        sys.path.remove(root_text)
    sys.path.insert(0, root_text)
    suite_module = load_project_module(root, suite_path, "_focused_spec_selected_suite")
    suite = getattr(suite_module, suite_export, None)

    from focused_spec_scenarios import Driver, DriverBinding, Suite, validate_scenario, verify_specification_async

    require(isinstance(suite, Suite), "runtime suite export is not a Suite")
    require(isinstance(suite.driver, DriverBinding), "runtime suite has no DriverBinding")
    require(suite.driver.path == binding["path"] and suite.driver.export == binding["export"], "runtime driver binding changed")
    runtime_inventory: list[tuple[str, str]] = []
    runtime_by_id: dict[str, Any] = {}
    for scenario in suite.scenarios:
        validate_scenario(scenario)
        require(scenario.id not in runtime_by_id, f"duplicate runtime scenario ID: {scenario.id}")
        runtime_by_id[scenario.id] = scenario
        runtime_inventory.append((scenario.id, scenario.name))
    require(runtime_inventory == expected_inventory, "runtime scenario inventory changed after resolution")

    driver_module = suite_module if driver_path == suite_path else load_project_module(root, driver_path, "_focused_spec_selected_driver")
    driver = getattr(driver_module, driver_export, None)
    require(isinstance(driver, Driver), "runtime driver export is not a Driver")

    results: list[dict[str, object]] = []
    for target in selection:
        scenario = runtime_by_id[target["id"]]
        require(scenario.name == target["name"], "runtime selected scenario identity changed")
        events = Events()
        result: dict[str, object] = {"targetId": target["targetId"], "status": "fail", "events": events.values}
        try:
            cancellation.task = asyncio.current_task()
            await verify_specification_async(
                driver,
                scenario,
                on_event=events.emit,
                cancelled=cancellation.cancelled,
            )
            result["status"] = "pass"
        except BaseException as error:
            result["diagnostic"] = diagnostic(error)
        results.append(result)
        if cancellation.cancelled():
            break
    return {"protocol": 1, "nonce": nonce, "results": results}


def write_report(path: str, report: dict[str, object]) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        stream.write("\n")


def main() -> None:
    if len(sys.argv) != 2 or not os.path.isabs(sys.argv[1]):
        raise RequestError("Python worker requires one absolute report path")
    raw = sys.stdin.buffer.read(INPUT_LIMIT + 1)
    if len(raw) > INPUT_LIMIT:
        raise RequestError("Python worker input exceeds 4000000 bytes")
    request = json.loads(raw)
    report = asyncio.run(execute(request))
    write_report(sys.argv[1], report)


if __name__ == "__main__":
    main()
