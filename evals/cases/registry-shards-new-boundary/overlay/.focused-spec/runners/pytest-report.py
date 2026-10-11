import json
import os
import sys

import pytest

sys.path.insert(0, os.getcwd())


class Report:
    def __init__(self):
        self.collected = []
        self.reports = []

    def pytest_collection_finish(self, session):
        self.collected = [item.nodeid for item in session.items]

    def pytest_runtest_logreport(self, report):
        self.reports.append({"id": report.nodeid, "when": report.when, "outcome": report.outcome})


mode, selector = sys.argv[1:]
report = Report()
args = ["-q", selector]
if mode == "collect":
    args.append("--collect-only")
code = pytest.main(args, plugins=[report])
print("FOCUSED_REPORT=" + json.dumps({"code": int(code), "collected": report.collected, "reports": report.reports}))
