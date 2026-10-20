package bank

import (
	"fmt"
	"math"
)

// Event records one fact in an account's history. Amounts are integer cents.
type Event struct {
	Type   string `json:"type"`
	Cents  int64  `json:"cents"`
	Reason string `json:"reason,omitempty"`
}

// Command requests one account operation. Amounts are integer cents.
type Command struct {
	Type  string `json:"type"`
	Cents int64  `json:"cents"`
}

// Account rebuilds its state from history and emits only new events.
type Account struct {
	opened bool
	balance int64
}

// From restores an account from its complete event history.
func From(history []Event) (*Account, error) {
	account := &Account{}
	for index, event := range history {
		if err := account.apply(event); err != nil {
			return nil, fmt.Errorf("history event %d: %w", index, err)
		}
	}
	return account, nil
}

// Explain receives a real domain decision and its structured values.
type Explain func(message string, data any)

// Handle validates one command and returns the newly emitted events.
func (a *Account) Handle(command Command, explain Explain) ([]Event, error) {
	var event Event
	switch command.Type {
	case "OpenAccount":
		if a.opened {
			return nil, fmt.Errorf("account is already open")
		}
		event = Event{Type: "AccountOpened"}
	case "DepositMoney", "WithdrawMoney":
		if !a.opened {
			return nil, fmt.Errorf("account is not open")
		}
		if command.Cents <= 0 {
			return nil, fmt.Errorf("amount must be positive integer cents")
		}
		if command.Type == "DepositMoney" {
			if command.Cents > math.MaxInt64-a.balance {
				return nil, fmt.Errorf("balance exceeds the supported amount")
			}
			event = Event{Type: "MoneyDeposited", Cents: command.Cents}
		} else if command.Cents > a.balance {
			if explain != nil {
				explain("Withdrawal declined", map[string]any{"requestedCents": command.Cents, "availableCents": a.balance, "decision": "declined"})
			}
			event = Event{Type: "WithdrawalDeclined", Cents: command.Cents, Reason: "insufficient-funds"}
		} else {
			if explain != nil {
				explain("Withdrawal allowed", map[string]any{"requestedCents": command.Cents, "availableCents": a.balance, "decision": "allowed"})
			}
			event = Event{Type: "MoneyWithdrawn", Cents: command.Cents}
		}
	default:
		return nil, fmt.Errorf("unknown command: %s", command.Type)
	}
	if err := a.apply(event); err != nil {
		return nil, err
	}
	return []Event{event}, nil
}

func (a *Account) apply(event Event) error {
	switch event.Type {
	case "AccountOpened":
		if a.opened {
			return fmt.Errorf("account is already open")
		}
		a.opened = true
	case "MoneyDeposited":
		if !a.opened {
			return fmt.Errorf("account is not open")
		}
		if event.Cents <= 0 || event.Cents > math.MaxInt64-a.balance {
			return fmt.Errorf("invalid deposited amount: %d", event.Cents)
		}
		a.balance += event.Cents
	case "MoneyWithdrawn":
		if !a.opened {
			return fmt.Errorf("account is not open")
		}
		if event.Cents <= 0 || event.Cents > a.balance {
			return fmt.Errorf("invalid withdrawn amount: %d", event.Cents)
		}
		a.balance -= event.Cents
	case "WithdrawalDeclined":
		if !a.opened {
			return fmt.Errorf("account is not open")
		}
		if event.Cents <= 0 || event.Reason != "insufficient-funds" {
			return fmt.Errorf("invalid declined withdrawal")
		}
	default:
		return fmt.Errorf("unknown event: %s", event.Type)
	}
	return nil
}
