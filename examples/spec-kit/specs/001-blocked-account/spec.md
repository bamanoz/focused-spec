# Feature Specification: Blocked Account Login Protection

**Feature Branch**: `001-blocked-account`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Prevent blocked accounts from logging in even when they submit valid credentials."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reject a Blocked Account (Priority: P1)

As an authentication operator, I need a blocked account to be denied at login so that an administrative block cannot be bypassed with otherwise valid credentials.

**Why this priority**: A block is a deliberate security control. Allowing a blocked account to authenticate would defeat that control and expose protected resources.

**Independent Test**: Attempt login for a blocked account with valid credentials and verify that no authenticated session is allowed.

**Acceptance Scenarios**:

1. **Given** an account is blocked and its submitted credentials are valid, **When** the account attempts to log in, **Then** authentication is rejected.

**Focused executable evidence**: The block below is maintained alongside the native Spec Kit acceptance scenario. `focused-spec` parses this explicit block; it does not infer executable evidence from the Given/When/Then prose above.

#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `pytest-functional::tests/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected

### Edge Cases

- Invalid credentials remain rejected regardless of whether the account is blocked.
- Removing an account block restores the normal credential-based login decision; it does not itself make invalid credentials valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST reject authentication when the account is blocked.
- **FR-002**: The blocked-account decision MUST take precedence over valid credentials.
- **FR-003**: The system MUST require valid credentials when the account is not blocked.

### Key Entities *(include if feature involves data)*

- **Account**: The identity attempting to log in, including whether an administrative block is active.
- **Login attempt**: A request to authenticate an account, including the result of credential validation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every login attempt by a blocked account is rejected, including attempts with valid credentials.
- **SC-002**: An unblocked account with valid credentials remains eligible to authenticate.

## Assumptions

- Credential validity has already been determined before the final login authorization decision.
- Blocking and unblocking an account is managed outside this feature.
- Rejection means that no authenticated session is created.
