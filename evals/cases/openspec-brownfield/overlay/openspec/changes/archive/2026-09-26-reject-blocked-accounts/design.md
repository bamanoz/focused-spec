## Context

Go and Python expose separate boolean authentication functions. Both currently return credential validity without checking account status.

## Goals / Non-Goals

**Goals:** Reject blocked accounts in each implementation while preserving active-account authentication.

**Non-Goals:** Change signatures, add persistence, or coordinate state between applications.

## Decisions

Each function returns the conjunction of not-blocked and valid credentials. This keeps status enforcement at the authentication decision in each language, rather than relying on callers to remember a separate check.

## Risks / Trade-offs

The functions only receive a boolean status; obtaining current status remains the caller's responsibility, as before.
