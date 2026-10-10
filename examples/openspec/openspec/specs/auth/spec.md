### Requirement: Blocked accounts cannot authenticate
A blocked account SHALL be rejected independently of credential validity.

<!-- focused-spec:id=auth.login.blocked-account -->
#### Scenario: Blocked account submits valid credentials
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
