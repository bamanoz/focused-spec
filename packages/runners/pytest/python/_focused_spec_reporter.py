"""Machine-readable pytest collection and per-phase reports for focused-spec."""

import json
from pathlib import Path
import pytest

_REPORT_PATH = None
_CONFIG = None
_collected = []
_collection_errors = []
_reports = []


def pytest_addoption(parser):
    parser.addoption("--focused-spec-report", action="store")


def pytest_configure(config):
    global _REPORT_PATH, _CONFIG
    _REPORT_PATH = config.getoption("--focused-spec-report")
    _CONFIG = config


def pytest_collectreport(report):
    if report.failed:
        _collection_errors.append(str(report.longrepr))


def pytest_collection_finish(session):
    _collected.extend(item.nodeid for item in session.items)


def pytest_runtest_logreport(report):
    if report.when not in ("setup", "call", "teardown"):
        return
    diagnostic = str(report.longrepr) if report.failed or report.skipped else ""
    _reports.append({
        "nodeid": report.nodeid,
        "phase": report.when,
        "outcome": report.outcome,
        "diagnostic": diagnostic,
    })


@pytest.hookimpl(optionalhook=True)
def pytest_testnodedown(node, error):
    worker = getattr(node, "workeroutput", None)
    if isinstance(worker, dict):
        _collection_errors.extend(item for item in worker.get("focusedSpecCollectionErrors", []) if isinstance(item, str))
        collected = worker.get("focusedSpecCollected", [])
        if isinstance(collected, list) and all(isinstance(item, str) for item in collected):
            if not _collected:
                _collected.extend(collected)
            elif _collected != collected:
                _collection_errors.append("xdist workers collected different selected tests")
    if error is not None:
        _collection_errors.append(str(error))


def pytest_sessionfinish(session, exitstatus):
    config = _CONFIG
    if config is not None and hasattr(config, "workeroutput"):
        config.workeroutput["focusedSpecCollected"] = _collected
        config.workeroutput["focusedSpecCollectionErrors"] = _collection_errors
        return
    if not _REPORT_PATH:
        return
    payload = {
        "collected": _collected,
        "collectionErrors": _collection_errors,
        "reports": _reports,
        "exitStatus": int(exitstatus),
    }
    path = Path(_REPORT_PATH)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload), encoding="utf-8")
    temporary.replace(path)
