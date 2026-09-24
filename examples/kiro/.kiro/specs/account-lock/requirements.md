# Requirements Document

## Introduction

Repeated failed sign-ins must move an account into a locked state at a defined threshold so that credential guessing cannot continue indefinitely.

## Requirements

### Requirement 1: Lock an account at the failed-sign-in threshold

**User Story:** As an account owner, I want repeated failed sign-ins to lock my account so that an attacker cannot keep guessing my credentials.

#### Acceptance Criteria

1. WHEN an unlocked account has recorded fewer than five consecutive failed sign-ins THEN the authentication service SHALL keep the account active.
2. WHEN an unlocked account records its fifth consecutive failed sign-in THEN the authentication service SHALL mark the account as locked.
