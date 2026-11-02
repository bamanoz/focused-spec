# Proposal

## Why

Repository verification and coordinated npm, Go, PyPI, and .NET GitHub Release publishing are manual and vulnerable to partial publication or inconsistent versions. The existing release gate couples toolchain/network-dependent checks to default tests, repeats repository Vitest evidence, and does not surface completed-but-active OpenSpec changes.

## What Changes

- Provide local, explicitly selectable Node-only and native-toolchain verification tiers with actionable preflight; pin pytest for release verification.
- Add a coordinated version checker covering every npm workspace manifest, hardcoded release/test versions, Python and .NET package metadata, and the independently tagged Go module (`packages/sdk/go/vX.Y.Z`).
- Add portable GitHub Actions-compatible workflow definitions runnable locally with open-source `act` and Docker; GitHub-hosted runners and billed Actions execution are out of scope. Automate authorized release verification/publication through local scripts and authenticated `gh`/registry clients, including verified `.NET .nupkg` GitHub Release assets and the Go module tag. Do not publish to NuGet.org.
- Publish the four Python/.NET CLI plugins to npm only after exact package names and publishing access are available. On 2026-10-29 all four exact names returned registry `E404`; resolve availability before requiring them in a complete npm release.
- Separate Node-only tests from native-toolchain/network checks, avoid duplicate Vitest evidence, split giant test files by behavior, and replace incidental CLI copy checks with structural interaction-contract assertions.
- Add a read-only active-OpenSpec-completion report; do not sync, archive, or edit lifecycle state. The four already completed/stale active changes remain unarchived.
- Document local `act`/Docker, host toolchain, GitHub CLI authorization, and registry credential prerequisites. Credentials are supplied to the authorized local publisher process only and are never persisted in source or workflow files.

## Capabilities

### New Capabilities

- `release-automation`: Reproducible local verification, test-tier selection, coordinated release preparation/publication, version consistency, and stale active-change reporting.

### Modified Capabilities

None.

## Impact

Local GitHub Actions-compatible workflow definitions, `act`/Docker invocation, verification/release scripts, root test scripts, focused test modules, package metadata/version references, and release/development documentation. No workflow targets or invokes GitHub-hosted runners, and no paid Actions execution is required. The .NET GitHub Release asset and local-feed SHA-256 contract are owned by `improve-native-sdk-distribution`; this change automates its local publication without NuGet.org. No OpenSpec or Spec Kit integration is included. No OpenSpec spec synchronization or archive operation is included.