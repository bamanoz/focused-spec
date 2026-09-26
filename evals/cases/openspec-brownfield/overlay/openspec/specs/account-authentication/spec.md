## Purpose

Define account status and credential requirements for Go and Python authentication.

## Requirements

### Requirement: Account authentication respects blocked status

The Go and Python authentication functions SHALL reject blocked accounts regardless of credential validity and SHALL authenticate active accounts only when credentials are valid.

#### Scenario: Blocked account with valid credentials
- **WHEN** a blocked account supplies valid credentials to either authentication function
- **THEN** authentication is rejected

#### Scenario: Blocked account with invalid credentials
- **WHEN** a blocked account supplies invalid credentials to either authentication function
- **THEN** authentication is rejected

#### Scenario: Active account with valid credentials
- **WHEN** an active account supplies valid credentials to either authentication function
- **THEN** authentication succeeds

#### Scenario: Active account with invalid credentials
- **WHEN** an active account supplies invalid credentials to either authentication function
- **THEN** authentication is rejected
