# Design

## Context

See [proposal.md](./proposal.md). The Python project metadata currently uses the legacy text license field and lacks project URLs/classifiers and `py.typed`. The .NET SDK project targets only `net9.0`; its deliberate delivery path is a pinned GitHub Release asset downloaded into a local NuGet feed, while the CLI reference hard-codes an older release version. Go's SDK `go.mod` currently contains only module path and Go language version, although release docs describe a versioned submodule tag. Existing language-specific consumer tests already exercise wheel installs and locally packed NuGet consumers.

## Goals / Non-Goals

**Goals:** Produce language-native package artifacts with accurate metadata, supported .NET target assets, a reproducible GitHub Release/local-feed .NET installation path, and matching consumer documentation.

**Non-Goals:** Change SDK execution behavior or APIs; change the chosen GitHub Release distribution channel; publish npm CLI plugins; alter CLI-owned integration guidance; or remove checkout-local replacements used by repository examples.

## Decisions

1. **Python metadata follows installed package standards.** Replace the legacy license declaration with the PEP 639 SPDX expression, declare project URLs and classifiers for the supported Python/runtime audience, and include `py.typed` in both wheel and sdist outputs. Keep license text included and preserve `Requires-Python >=3.11`. Validate built artifacts and installed package metadata.
2. **The .NET target set is exactly `net8.0;net10.0`.** Multi-target the existing SDK project and package the same public API for both targets. Do not add a `net9.0` target merely because existing plugin consumers target .NET 9; adapt consumer fixtures as needed to consume the compatible SDK asset without changing the approved SDK target set. Keep SDK runtime dependencies absent.
3. **GitHub Release/local feed is the sole .NET distribution path.** The coordinated GitHub Release carries the verified `.nupkg` asset. Human consumer instructions download the matching versioned asset, verify SHA-256, place it in a project-local NuGet feed, and restore the pinned package. Preserve safeguards for custom sources, package source mapping, and repeatable CI restore. No Microsoft account is needed.
4. **CI owns GitHub Release publication.** This change owns package metadata/target set and consumer installation documentation. The separate CI/release change automates publication of the verified `.nupkg` as a GitHub Release asset with SHA-256 verification and version checks; it consumes the local-feed consumer path defined here.
5. **Go version stamping remains a release concern.** Keep the canonical module path and `go 1.23`, and represent the module version in the Go example's `go.mod` as an explicit template marker that release preparation can replace with the coordinated version. Repository test/example consumers retain their local `replace`; a clean external consumer must resolve the stamped version without one. Release workflow automation itself is owned by the CI change.
6. **Documentation uses one current installation guide.** Make `docs/guides/install.md` the detailed human source for Python and .NET SDK install flows, update every .NET SDK installation section there and in the SDK README, and replace the stale pinned-version claim in `docs/reference/cli.md` with a concise link to that guide. Do not edit CLI-owned `guidance/*.md` or npm plugin release instructions.

## Exact evidence

| Native ID | Required Vitest reference(s) |
| --- | --- |
| `distribution.native-sdk-metadata` | `vitest::test/python-scenarios.spec.ts::python executable scenarios > runs the packed SDK without framework dependencies`; `vitest::test/dotnet-scenarios.spec.ts::dotnet executable scenarios > runs the packed SDK without focused-spec`; `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes the Go SDK without Node dependencies` |
| `distribution.native-dotnet-targets` | `vitest::test/dotnet-scenarios.spec.ts::dotnet executable scenarios > runs the packed SDK without focused-spec`; `vitest::test/dotnet-native-plugins.spec.ts::dotnet native plugins > preserves standalone suites and optional driver bindings` |
| `distribution.native-go-version-template` | `vitest::test/go-executable-scenarios.spec.ts::Go executable scenarios > executes the Go SDK without Node dependencies` |
| `distribution.native-python-install` | `vitest::test/python-scenarios.spec.ts::python executable scenarios > runs the packed SDK without framework dependencies` |
| `distribution.native-dotnet-install` | `vitest::test/dotnet-scenarios.spec.ts::dotnet executable scenarios > runs the packed SDK without focused-spec` |
| `distribution.native-dotnet-restore` | `vitest::test/dotnet-scenarios.spec.ts::dotnet executable scenarios > runs the packed SDK without focused-spec` |
| `distribution.native-dotnet-reference` | No behavioral test selector; verify the rendered links and text by reviewing the owning Markdown sections. |

The selectors identify existing owning tests as starting points; apply must extend them to assert the new package metadata, target frameworks, version-template behavior, and local-feed consumer installation contract. Enroll these references only during apply. Package publication is owned by the CI/release change; this change does not perform a release.

## Risks / Trade-offs

- Existing native plugin tests and examples target .NET 9. Supporting only `net8.0` and `net10.0` may require consumer-framework adjustments for the .NET 9 plugin path, without expanding the approved SDK target set.
- A Go version marker is intentionally not a valid published version by itself; release preparation must replace it before creating the module tag. CI mechanics belong to the separate automation change.
- GitHub Release/local-feed installation requires downloading the exact versioned asset before restore. The guide must make checksum verification and repeatable local-feed setup clear across clean machines and CI.
