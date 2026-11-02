# Proposal

## Why

The Python and Go SDK source trees are usable, but their package metadata and consumer installation paths are incomplete or inconsistent. The .NET SDK already has a deliberate GitHub Release/local NuGet feed distribution path; define it as the sole .NET delivery contract and make its package and documentation reliable without requiring a Microsoft account.

## What Changes

- Complete Python wheel and source-distribution metadata with `py.typed`, PEP 639 SPDX license metadata, project URLs, and relevant classifiers.
- Prepare the .NET package with repository metadata and `net8.0;net10.0` targets, keeping it independent of focused-spec, parser, and xUnit runtime dependencies.
- Make the verified `.nupkg` on the coordinated GitHub Release the sole documented .NET distribution source, with a project-local NuGet feed, checksum verification, and repeatable restore; align SDK and consumer installation documentation and remove stale pinned .NET details from the CLI reference.
- Change the Go example's module declaration to a release-version template suitable for stamping the coordinated module version while retaining checkout-local replacements for repository verification.
- Align CI ownership: the CI/release change automates verified GitHub Release publication for the .NET package.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `distribution`: Define consumer-facing installation and independently consumable package metadata for native Python, .NET, and Go SDK distributions.

## Impact

Python package metadata and package contents under `packages/sdk/python`; the .NET SDK project and README under `packages/sdk/dotnet`; the Go SDK `go.mod` release template; `docs/guides/install.md`, its .NET SDK installation sections, and `docs/reference/cli.md`'s stale .NET installation reference; and the `distribution` OpenSpec capability. CI/release workflow automation owns the GitHub Release publication; npm CLI plugin publication remains outside this change.