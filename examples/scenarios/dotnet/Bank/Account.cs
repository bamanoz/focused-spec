namespace ScenarioBank.Bank;

public sealed record AccountEvent(string Type, int Cents = 0, string? Reason = null);
public sealed record AccountCommand(string Type, int Cents = 0);

public sealed class Account
{
    private bool _opened;
    private int _balance;

    public static Account Restore(IEnumerable<AccountEvent> history)
    {
        var account = new Account();
        foreach (var item in history) account.Apply(item);
        return account;
    }

    public IReadOnlyList<AccountEvent> Handle(AccountCommand command, Action<string, object?> explain)
    {
        AccountEvent result;
        if (command.Type == "OpenAccount")
        {
            if (_opened) throw new InvalidOperationException("Account is already open");
            result = new AccountEvent("AccountOpened");
        }
        else
        {
            if (!_opened) throw new InvalidOperationException("Account is not open");
            if (command.Type is not ("DepositMoney" or "WithdrawMoney")) throw new InvalidOperationException($"Unknown command: {command.Type}");
            if (command.Cents <= 0) throw new InvalidOperationException("Amount must be a positive integer in cents");
            if (command.Type == "DepositMoney")
            {
                if (_balance > int.MaxValue - command.Cents) throw new InvalidOperationException("Balance exceeds supported amount");
                result = new AccountEvent("MoneyDeposited", command.Cents);
            }
            else if (command.Cents > _balance)
            {
                result = new AccountEvent("WithdrawalDeclined", command.Cents, "insufficient-funds");
                explain("Withdrawal declined", new { requestedCents = command.Cents, availableCents = _balance });
            }
            else
            {
                result = new AccountEvent("MoneyWithdrawn", command.Cents);
                explain("Withdrawal allowed", new { requestedCents = command.Cents, availableCents = _balance });
            }
        }
        Apply(result);
        return [result];
    }

    private void Apply(AccountEvent item)
    {
        switch (item.Type)
        {
            case "AccountOpened": _opened = true; break;
            case "MoneyDeposited": _balance += item.Cents; break;
            case "MoneyWithdrawn": _balance -= item.Cents; break;
            case "WithdrawalDeclined": break;
            default: throw new InvalidOperationException($"Unknown event: {item.Type}");
        }
    }
}
