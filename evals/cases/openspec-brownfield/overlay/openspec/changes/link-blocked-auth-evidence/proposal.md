## Why

The project already has OpenSpec specifications and Go/Python tests but no exact executable evidence for the blocked-account valid-credential outcome.

## What Changes

- Link one previously unverified outcome to the existing Go and Python tests through version-4 focused-spec configuration and explicitly installed adapters.
- Keep historical OpenSpec scenarios intact while using the normal delta sync workflow.

## Capabilities

### Modified Capabilities

- `account-authentication`: Add exact executable evidence to the existing blocked-account-with-valid-credentials scenario.

## Impact

Only specification metadata and focused-spec adapter registration are added; product behavior stays unchanged.
