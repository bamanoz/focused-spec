package specifications

import (
	"example.com/scenario-bank/bank"
	scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
)

// Account is the executable account specification, not a reference to another document.
// Given is past events, When is one command, and Expect is exactly the newly emitted events.
var Account = scenarios.Suite[[]bank.Event, bank.Command, []bank.Event]{
	Driver: scenarios.DriverBinding{Path: "account.driver.go", Export: "AccountDriver"},
	Scenarios: []scenarios.Scenario[[]bank.Event, bank.Command, []bank.Event]{
		{
			ID: "account.open",
			Name: "Opening an account emits AccountOpened",
			Given: []bank.Event{},
			When: bank.Command{Type: "OpenAccount"},
			Expect: []bank.Event{{Type: "AccountOpened"}},
		},
		{
			ID: "account.deposit",
			Name: "Depositing money records the deposited amount",
			Given: []bank.Event{{Type: "AccountOpened"}},
			When: bank.Command{Type: "DepositMoney", Cents: 5000},
			Expect: []bank.Event{{Type: "MoneyDeposited", Cents: 5000}},
		},
		{
			ID: "account.withdraw.history",
			Name: "A withdrawal uses the balance rebuilt from the complete history",
			Given: []bank.Event{
				{Type: "AccountOpened"},
				{Type: "MoneyDeposited", Cents: 5000},
				{Type: "MoneyDeposited", Cents: 3000},
				{Type: "MoneyWithdrawn", Cents: 2000},
			},
			When: bank.Command{Type: "WithdrawMoney", Cents: 6000},
			Expect: []bank.Event{{Type: "MoneyWithdrawn", Cents: 6000}},
		},
		{
			ID: "account.withdraw.entire-balance",
			Name: "Withdrawing the entire balance is allowed",
			Given: []bank.Event{
				{Type: "AccountOpened"},
				{Type: "MoneyDeposited", Cents: 5000},
			},
			When: bank.Command{Type: "WithdrawMoney", Cents: 5000},
			Expect: []bank.Event{{Type: "MoneyWithdrawn", Cents: 5000}},
		},
		{
			ID: "account.withdraw.insufficient-funds",
			Name: "A withdrawal exceeding the remaining balance is declined",
			Given: []bank.Event{
				{Type: "AccountOpened"},
				{Type: "MoneyDeposited", Cents: 5000},
				{Type: "MoneyWithdrawn", Cents: 2000},
			},
			When: bank.Command{Type: "WithdrawMoney", Cents: 4000},
			Expect: []bank.Event{{Type: "WithdrawalDeclined", Cents: 4000, Reason: "insufficient-funds"}},
		},
		{
			ID: "account.withdraw.after-decline",
			Name: "A previously declined withdrawal does not consume money",
			Given: []bank.Event{
				{Type: "AccountOpened"},
				{Type: "MoneyDeposited", Cents: 5000},
				{Type: "WithdrawalDeclined", Cents: 6000, Reason: "insufficient-funds"},
			},
			When: bank.Command{Type: "WithdrawMoney", Cents: 5000},
			Expect: []bank.Event{{Type: "MoneyWithdrawn", Cents: 5000}},
		},
	},
}
