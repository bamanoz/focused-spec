// Amounts are integer cents. Past events restore state; a command emits only new events.
export class Account {
  #opened = false;
  #balance = 0;

  static from(history) {
    const account = new Account();
    for (const event of history) account.#apply(event);
    return account;
  }

  handle(command, explain) {
    let event;
    if (command.type === 'OpenAccount') {
      if (this.#opened) throw new Error('Account is already open');
      event = { type: 'AccountOpened' };
    } else {
      if (!this.#opened) throw new Error('Account is not open');
      if (!['DepositMoney', 'WithdrawMoney'].includes(command.type)) {
        throw new Error(`Unknown command: ${command.type}`);
      }
      if (!Number.isSafeInteger(command.cents) || command.cents <= 0) {
        throw new Error('Amount must be a positive safe integer in cents');
      }
      if (command.type === 'DepositMoney') {
        if (!Number.isSafeInteger(this.#balance + command.cents)) {
          throw new Error('Balance exceeds the supported amount');
        }
        event = { type: 'MoneyDeposited', cents: command.cents };
      } else if (command.cents > this.#balance) {
        event = {
          type: 'WithdrawalDeclined',
          cents: command.cents,
          reason: 'insufficient-funds',
        };
        explain?.('Withdrawal declined', {
          requestedCents: command.cents,
          availableCents: this.#balance,
        });
      } else {
        event = { type: 'MoneyWithdrawn', cents: command.cents };
        explain?.('Withdrawal allowed', {
          requestedCents: command.cents,
          availableCents: this.#balance,
        });
      }
    }
    this.#apply(event);
    return [event];
  }

  #apply(event) {
    switch (event.type) {
      case 'AccountOpened':
        this.#opened = true;
        break;
      case 'MoneyDeposited':
        this.#balance += event.cents;
        break;
      case 'MoneyWithdrawn':
        this.#balance -= event.cents;
        break;
      case 'WithdrawalDeclined':
        // A declined withdrawal records a decision but never changes the balance.
        break;
      default:
        throw new Error(`Unknown event: ${event.type}`);
    }
  }
}
