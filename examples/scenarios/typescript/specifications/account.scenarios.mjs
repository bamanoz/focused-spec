import { defineSuite } from '@focused-spec/scenarios-typescript';

// These objects ARE the executable specifications, not references to another document.
// Given: past events. When: one command. Expect: exactly the newly emitted events.
export default defineSuite({
  driver: './account.driver.mjs',
  scenarios: [
  {
    id: 'account.open',
    name: 'Opening an account emits AccountOpened',
    given: [],
    when: { type: 'OpenAccount' },
    expect: [{ type: 'AccountOpened' }],
  },
  {
    id: 'account.deposit',
    name: 'Depositing money records the deposited amount',
    given: [{ type: 'AccountOpened' }],
    when: { type: 'DepositMoney', cents: 5000 },
    expect: [{ type: 'MoneyDeposited', cents: 5000 }],
  },
  {
    id: 'account.withdraw.history',
    name: 'A withdrawal uses the balance rebuilt from the complete history',
    given: [
      { type: 'AccountOpened' },
      { type: 'MoneyDeposited', cents: 5000 },
      { type: 'MoneyDeposited', cents: 3000 },
      { type: 'MoneyWithdrawn', cents: 2000 },
    ],
    when: { type: 'WithdrawMoney', cents: 6000 },
    expect: [{ type: 'MoneyWithdrawn', cents: 6000 }],
  },
  {
    id: 'account.withdraw.entire-balance',
    name: 'Withdrawing the entire balance is allowed',
    given: [
      { type: 'AccountOpened' },
      { type: 'MoneyDeposited', cents: 5000 },
    ],
    when: { type: 'WithdrawMoney', cents: 5000 },
    expect: [{ type: 'MoneyWithdrawn', cents: 5000 }],
  },
  {
    id: 'account.withdraw.insufficient-funds',
    name: 'A withdrawal exceeding the remaining balance is declined',
    given: [
      { type: 'AccountOpened' },
      { type: 'MoneyDeposited', cents: 5000 },
      { type: 'MoneyWithdrawn', cents: 2000 },
    ],
    when: { type: 'WithdrawMoney', cents: 4000 },
    expect: [
      { type: 'WithdrawalDeclined', cents: 4000, reason: 'insufficient-funds' },
    ],
  },
  {
    id: 'account.withdraw.after-decline',
    name: 'A previously declined withdrawal does not consume money',
    given: [
      { type: 'AccountOpened' },
      { type: 'MoneyDeposited', cents: 5000 },
      { type: 'WithdrawalDeclined', cents: 6000, reason: 'insufficient-funds' },
    ],
    when: { type: 'WithdrawMoney', cents: 5000 },
    expect: [{ type: 'MoneyWithdrawn', cents: 5000 }],
  },
  ],
});
