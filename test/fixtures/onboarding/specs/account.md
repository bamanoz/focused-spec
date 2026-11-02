#### Scenario: A deposit increases the balance
- **ID**: `account.deposit`
- **EVIDENCE**: `vitest::test/account.spec.mjs::account > deposits funds`
- **WHEN** 25 cents are deposited into a 100-cent account
- **THEN** the balance is 125 cents
