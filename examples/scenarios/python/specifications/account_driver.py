from focused_spec_scenarios import Driver

from src.account import Account


DRIVER = Driver(
    given=lambda history, _: Account.from_history(history),
    when=lambda account, command, context: account.handle(command, context.explain),
)
