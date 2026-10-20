using FocusedSpec.Scenarios;

namespace ScenarioBank.Bank;

public static class AccountScenarios
{
    public static readonly ScenarioSuite<AccountEvent[], AccountCommand, AccountEvent[]> Suite =
        new([
            new("account.open", "Opening an account emits AccountOpened", Array.Empty<AccountEvent>(), new("OpenAccount"), [new AccountEvent("AccountOpened")]),
            new("account.deposit", "Depositing money records the deposited amount", [new AccountEvent("AccountOpened")], new("DepositMoney", 5000), [new AccountEvent("MoneyDeposited", 5000)]),
            new("account.withdraw.history", "A withdrawal uses the balance rebuilt from the complete history", [new AccountEvent("AccountOpened"), new AccountEvent("MoneyDeposited", 5000), new AccountEvent("MoneyDeposited", 3000), new AccountEvent("MoneyWithdrawn", 2000)], new("WithdrawMoney", 6000), [new AccountEvent("MoneyWithdrawn", 6000)]),
            new("account.withdraw.entire-balance", "Withdrawing the entire balance is allowed", [new AccountEvent("AccountOpened"), new AccountEvent("MoneyDeposited", 5000)], new("WithdrawMoney", 5000), [new AccountEvent("MoneyWithdrawn", 5000)]),
            new("account.withdraw.insufficient-funds", "A withdrawal exceeding the remaining balance is declined", [new AccountEvent("AccountOpened"), new AccountEvent("MoneyDeposited", 5000), new AccountEvent("MoneyWithdrawn", 2000)], new("WithdrawMoney", 4000), [new AccountEvent("WithdrawalDeclined", 4000, "insufficient-funds")]),
            new("account.withdraw.after-decline", "A previously declined withdrawal does not consume money", [new AccountEvent("AccountOpened"), new AccountEvent("MoneyDeposited", 5000), new AccountEvent("WithdrawalDeclined", 6000, "insufficient-funds")], new("WithdrawMoney", 5000), [new AccountEvent("MoneyWithdrawn", 5000)]),
        ]);

    public static ScenarioDriver<Account, AccountEvent[], AccountCommand, AccountEvent[]> Driver => new()
    {
        Given = (history, _) => ValueTask.FromResult(Account.Restore(history)),
        When = (account, command, context) => ValueTask.FromResult(account.Handle(command, context.Explain).ToArray()),
    };
}
