## Why

The repository has Go unit and pytest functional coverage for blocked authentication but no focused executable contract connecting the product outcome to both suites.

## What Changes

- Add language-agnostic focused-spec configuration and scope-local evidence registry.
- Add project-local TypeScript runners for Go tests and pytest.
- Mark one native scenario and bind it to both existing tests.

## Capabilities

### New Capabilities

- `authentication-policy`: Executable focused evidence for blocked-account authentication.

## Impact

Only specification metadata and test runner adapters are added. Product behavior remains unchanged.
