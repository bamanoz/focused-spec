## Purpose

Define the executable administrative-block outcome for Go and Python authentication.

## Requirements

### Requirement: Administrative blocks override credentials

The Go and Python authentication functions SHALL reject blocked accounts regardless of credential validity.

#### Scenario: Blocked account with valid credentials
- **ID**: `Auth/Blocked 账户`
- **EVIDENCE**: `go::./auth::TestBlockedAccountWithValidCredentials`
- **EVIDENCE**: `pytest::tests/functional/test_auth.py::test_blocked_account_with_valid_credentials`
- **WHEN** a blocked account supplies valid credentials to either authentication function
- **THEN** authentication is rejected
