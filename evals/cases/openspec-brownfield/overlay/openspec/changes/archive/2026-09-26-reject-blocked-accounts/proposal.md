## Why

Both authentication implementations currently accept valid credentials for blocked accounts. Blocking must prevent access without disrupting active accounts.

## What Changes

- Reject blocked accounts in Go and Python authentication regardless of credential validity.
- Preserve authentication for active accounts with valid credentials and rejection of invalid credentials.
- Add regression coverage in both languages.

## Capabilities

### New Capabilities
- `account-authentication`: Account status and credential requirements for authentication in both applications.

### Modified Capabilities
- None.

## Impact

The Go `auth.Authenticate` and Python `app.auth.authenticate` return values change for blocked accounts with valid credentials. Their signatures remain unchanged.
