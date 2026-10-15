## MODIFIED Requirements

### Requirement: Administrative blocks override credentials
The Go and Python authentication functions SHALL reject blocked accounts regardless of credential validity.

#### Scenario: Administrative block overrides valid credentials
- **WHEN** an administratively blocked account supplies otherwise valid credentials to either authentication function
- **THEN** authentication is rejected before an authenticated session can be created
