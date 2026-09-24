# Focused Specification

#### Scenario: Fifth consecutive failed sign-in locks the account
- **ID**: `account.lock.threshold-reached`
- **EVIDENCE**: `pytest-functional::tests/test_account_lock.py::test_account_locks_at_failure_threshold`
- **WHEN** an unlocked account records its fifth consecutive failed sign-in
- **THEN** the account status becomes locked
