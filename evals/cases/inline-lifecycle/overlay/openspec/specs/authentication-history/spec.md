## Purpose

Preserve established account-authentication outcomes that are outside this executable revision.

## Requirements

### Requirement: Historical account authentication outcomes

The Go and Python authentication functions SHALL reject invalid credentials and SHALL authenticate active accounts with valid credentials.

#### Scenario: Blocked account with invalid credentials
- **WHEN** a blocked account supplies invalid credentials to either authentication function
- **THEN** authentication is rejected

#### Scenario: Active account with valid credentials
- **WHEN** an active account supplies valid credentials to either authentication function
- **THEN** authentication succeeds

#### Scenario: Active account with invalid credentials
- **WHEN** an active account supplies invalid credentials to either authentication function
- **THEN** authentication is rejected
