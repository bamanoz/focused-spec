## Why

The project already has OpenSpec specifications and Go/Python tests but no exact executable evidence for the blocked-account valid-credential outcome.

## What Changes

- Link one previously unverified outcome to the existing Go and Python tests through focused-spec.
- Keep historical OpenSpec scenarios intact while using the normal delta sync workflow.

## Capabilities

### Modified Capabilities

- `account-authentication`: Add exact executable evidence to the existing blocked-account-with-valid-credentials scenario.

## Impact

Only specification metadata and project-local evidence runners are added; product behavior stays unchanged.
