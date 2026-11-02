# Tasks

## 1. Native package metadata and compatibility

- [x] 1.1 Update Python project metadata to use PEP 639 SPDX license metadata, declare project URLs and appropriate Python classifiers, include `py.typed` in built distributions, and verify wheel and sdist contents plus installed metadata.
- [x] 1.2 Multi-target `FocusedSpec.Scenarios` exactly for `net8.0;net10.0`, add NuGet repository metadata, and verify both packed target assets and a clean consumer restore/execution without adding SDK runtime dependencies.
- [x] 1.3 Replace the Go SDK example's unversioned module declaration with an explicit coordinated-version template, preserve its canonical module path and Go 1.23 language declaration, and verify repository consumers still use their local replacements while a stamped isolated consumer resolves without one.

## 2. Consumer installation documentation

- [x] 2.1 Make the GitHub Release `.nupkg` the sole documented .NET distribution source: document download, SHA-256 verification, project-local NuGet feed, pinned package reference, and repeatable restore; align the .NET SDK README and every .NET SDK installation section in `docs/guides/install.md`.
- [x] 2.2 Update the Python SDK installation section with the PyPI package path and the installed typing metadata contract; keep install guidance consistent with the package README.
- [x] 2.3 Replace the stale pinned .NET version and outdated installation details in `docs/reference/cli.md` with a concise link to the current GitHub Release/local-feed guide; verify affected documentation links and distinguish release-time version/checksum values from evergreen instructions.

## 3. Release readiness and verification

- [x] 3.1 Confirm the CI/release change publishes the verified .NET `.nupkg` as a GitHub Release asset with SHA-256 verification and version checks, consuming the documented local-feed path.
- [x] 3.2 Extend the existing Python, .NET, and Go SDK consumer checks to verify built package metadata, supported target frameworks, and version-template behavior, then run the exact evidence selectors listed in `design.md` and strictly validate the change. Do not publish packages or modify npm plugin workflows as part of this proposal.

Observed working-scope checkpoint: `./node_modules/.bin/focused-spec run --root . --scope improve-native-sdk-distribution` reported 7 PASS, 0 FAIL/SKIP/ERROR across 6 exact targets. Consumers exercised locally built distribution artifacts, not a new registry publication. The separately verified release orchestration covers the versioned `.nupkg`, checksum asset and local-feed contract using isolated fake clients; implementation verification did not authorize or perform publication.
