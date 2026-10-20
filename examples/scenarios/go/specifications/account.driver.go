package specifications

import (
	"context"

	"example.com/scenario-bank/bank"
	scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
)

// AccountDriver connects account specifications to the in-memory application.
var AccountDriver = scenarios.Driver[*bank.Account, []bank.Event, bank.Command, []bank.Event]{
	Given: func(ctx context.Context, history []bank.Event) (*bank.Account, error) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return bank.From(history)
	},
	When: func(ctx context.Context, account *bank.Account, command bank.Command) ([]bank.Event, error) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return account.Handle(command, func(message string, data any) {
			scenarios.Explain(ctx, message, data)
		})
	},
}
