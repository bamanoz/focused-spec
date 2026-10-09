#### Scenario: Adult age is eligible
- **ID**: `account.eligibility.adult`
- **EVIDENCE**: `go-unit::./eligibility::TestAdultEligible`
- **WHEN** the age is 18
- **THEN** the account is eligible
