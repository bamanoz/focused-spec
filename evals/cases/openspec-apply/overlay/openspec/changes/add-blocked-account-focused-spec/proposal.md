## Why

The repository has Go unit and pytest functional coverage for blocked authentication but no focused executable contract connecting the product outcome to both suites.

## What Changes

- Add language-agnostic focused-spec configuration.
- Add project-local TypeScript runners for Go tests and pytest.
- Add one focused scenario backed by both existing tests.

## Capabilities

### New Capabilities

- `authentication-policy`: Executable focused ownership for blocked-account authentication.

## Impact

Only specification metadata and test runner adapters are added. Product behavior remains unchanged.
