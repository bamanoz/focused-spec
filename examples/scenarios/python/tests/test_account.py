import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from focused_spec_scenarios import Driver, verify_specification

from src.account import Account
from specifications.account_scenarios import ACCOUNT_SCENARIOS


def driver() -> Driver:
    return Driver(
        given=lambda history, _: Account.from_history(history),
        when=lambda account, command, context: account.handle(command, context.explain),
    )


@pytest.mark.parametrize("scenario", ACCOUNT_SCENARIOS.scenarios, ids=lambda scenario: scenario.id)
def test_all_account_scenarios_pass_against_real_account(scenario) -> None:
    assert verify_specification(driver(), scenario) == scenario.expect

