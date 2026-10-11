# Account authentication

#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected

#### Scenario: Active account submits valid credentials
- **ID**: `auth.login.active-account`
- **EVIDENCE**: `go-unit::./auth::TestValidActiveAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_valid_active_account`
- **WHEN** an active account submits valid credentials
- **THEN** authentication succeeds

## Operational note

Administrators own account-blocking policy; this update does not change it.
