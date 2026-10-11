# Authentication refresh

#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **REVISES**: current
- **EVIDENCE**: `go-unit::./auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
