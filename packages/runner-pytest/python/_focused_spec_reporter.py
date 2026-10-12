"""Machine-readable pytest collection and per-phase reports for focused-spec."""

import json
from pathlib import Path

_REPORT_PATH = None
_collected = []
_collection_errors = []
_reports = []


def pytest_addoption(parser):
    parser.addoption("--focused-spec-report", action="store")


def pytest_configure(config):
    global _REPORT_PATH
    _REPORT_PATH = config.getoption("--focused-spec-report")


def pytest_collectreport(report):
    if report.failed:
        _collection_errors.append(str(report.longrepr))


def pytest_collection_finish(session):
    _collected.extend(item.nodeid for item in session.items)


def pytest_runtest_logreport(report):
    if report.when not in ("setup", "call", "teardown"):
        return
    diagnostic = ""
    if report.failed or report.skipped:
        diagnostic = str(report.longrepr)
    _reports.append(
        {
            "nodeid": report.nodeid,
            "phase": report.when,
            "outcome": report.outcome,
            "diagnostic": diagnostic,
        }
    )


def pytest_sessionfinish(session, exitstatus):
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
