## ADDED Requirements

### Requirement: Blocked accounts cannot authenticate
The authentication policy SHALL reject a blocked account independently of credential validity.

#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `planned:go-unit::./auth::TestBlockedAccount`
- **EVIDENCE**: `planned:pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
