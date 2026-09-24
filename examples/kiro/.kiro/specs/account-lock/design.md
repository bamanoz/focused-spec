# Design Document

## Overview

The account-lock domain exposes an immutable `AccountAccess` value and a `record_failed_sign_in` transition. Each failed sign-in increments the consecutive-failure count. The transition sets `locked` when the configured threshold is reached and leaves an already locked account unchanged.

Persistence and successful-sign-in handling remain outside this feature boundary; callers own storing the returned state and resetting counters after successful authentication.

## Correctness Properties

- Counts below the threshold remain unlocked.
- Reaching the threshold locks the returned state.
- A locked state never becomes unlocked through a failed-sign-in transition.
