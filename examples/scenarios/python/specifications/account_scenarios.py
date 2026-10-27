from focused_spec_scenarios import DriverBinding, Scenario, define_suite


ACCOUNT_SCENARIOS = define_suite(
    Scenario("account.open", "Opening an account emits AccountOpened", [], {"type": "OpenAccount"}, [{"type": "AccountOpened"}]),
    Scenario("account.deposit", "Depositing money records the deposited amount", [{"type": "AccountOpened"}], {"type": "DepositMoney", "cents": 5000}, [{"type": "MoneyDeposited", "cents": 5000}]),
    Scenario("account.withdraw.history", "A withdrawal uses the balance rebuilt from the complete history", [{"type": "AccountOpened"}, {"type": "MoneyDeposited", "cents": 5000}, {"type": "MoneyDeposited", "cents": 3000}, {"type": "MoneyWithdrawn", "cents": 2000}], {"type": "WithdrawMoney", "cents": 6000}, [{"type": "MoneyWithdrawn", "cents": 6000}]),
    Scenario("account.withdraw.entire-balance", "Withdrawing the entire balance is allowed", [{"type": "AccountOpened"}, {"type": "MoneyDeposited", "cents": 5000}], {"type": "WithdrawMoney", "cents": 5000}, [{"type": "MoneyWithdrawn", "cents": 5000}]),
    Scenario("account.withdraw.insufficient-funds", "A withdrawal exceeding the remaining balance is declined", [{"type": "AccountOpened"}, {"type": "MoneyDeposited", "cents": 5000}, {"type": "MoneyWithdrawn", "cents": 2000}], {"type": "WithdrawMoney", "cents": 4000}, [{"type": "WithdrawalDeclined", "cents": 4000, "reason": "insufficient-funds"}]),
    Scenario("account.withdraw.after-decline", "A previously declined withdrawal does not consume money", [{"type": "AccountOpened"}, {"type": "MoneyDeposited", "cents": 5000}, {"type": "WithdrawalDeclined", "cents": 6000, "reason": "insufficient-funds"}], {"type": "WithdrawMoney", "cents": 5000}, [{"type": "MoneyWithdrawn", "cents": 5000}]),
    driver=DriverBinding("account_driver.py", "DRIVER"),
)
