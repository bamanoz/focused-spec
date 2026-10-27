import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from focused_spec_scenarios import verify_specification

from specifications.account_driver import DRIVER
from specifications.account_scenarios import ACCOUNT_SCENARIOS


def main() -> None:
    driver = DRIVER
    for scenario in ACCOUNT_SCENARIOS.scenarios:
        events = []
        actual = verify_specification(driver, scenario, on_event=events.append)
        print(f"{scenario.name}: PASS")
        print(f"  GIVEN  {scenario.given!r}")
        print(f"  WHEN   {scenario.when!r}")
        print(f"  EXPECT {scenario.expect!r}")
        for event in events:
            if event.kind == "explanation":
                print(f"  EXPLAIN {event.message} {event.data!r}")
        print(f"  ACTUAL {actual!r}")


if __name__ == "__main__":
    main()
