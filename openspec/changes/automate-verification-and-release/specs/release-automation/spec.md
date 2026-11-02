# Spec Delta

## Purpose

Make repository verification and coordinated package releases repeatable across supported environments, detect inconsistent distribution versions before release, and surface completed active changes without performing lifecycle operations on their owners' behalf.

## ADDED Requirements

### Requirement: Local verification separates portable and native prerequisites

The repository SHALL provide separate local Node-only and native-toolchain verification tiers. Each native tier SHALL preflight its required tools and fail visibly when a prerequisite is missing; required checks SHALL NOT be silently skipped.

<!-- focused-spec:id=release.ci.tiers -->
#### Scenario: Node-only verification runs without native toolchains
- **WHEN** a contributor runs the Node-only tier in an environment without Go, Python, or .NET
- **THEN** it completes its declared checks without invoking native-toolchain tests and reports its tier distinctly from full native verification

<!-- focused-spec:id=release.ci.preflight -->
#### Scenario: Missing native verification prerequisites are actionable
- **WHEN** a contributor runs a native-toolchain tier with a required tool unavailable
- **THEN** preflight identifies the missing tool and affected checks before execution, and the requested tier fails rather than silently passing or skipping checks

### Requirement: Release versions are consistent across distributions

A release check SHALL compare coordinated npm, Python, and .NET versions and reject stale hardcoded release references. It SHALL validate the Go module identity and expected versioned subdirectory tag without treating `go.mod` as versioned distribution metadata.

<!-- focused-spec:id=release.version-consistency -->
#### Scenario: A drifted package version blocks release
- **WHEN** any coordinated npm, Python, or .NET package version differs from the selected release version, or a release-specific hardcoded version is stale
- **THEN** the version check reports the exact distribution or reference and exits unsuccessfully before publication

<!-- focused-spec:id=release.go-module-version -->
#### Scenario: Go module release is checked without a go.mod version field
- **WHEN** the coordinated version is prepared for release
- **THEN** the check validates the Go module identity and expected `packages/sdk/go/v<version>` tag plan without asserting that Go modules declare a semver version in `go.mod`

### Requirement: Release preparation uses authorized local publication

Local release automation SHALL prepare distributions from the exact release revision. It SHALL publish the verified .NET package as a GitHub Release asset under the distribution-owned SHA-256/local-feed contract and SHALL NOT publish to NuGet.org. Provenance SHALL be reported only when the selected local mechanism verifies it.

<!-- focused-spec:id=release.registry-provenance -->
#### Scenario: Required publisher configuration is missing
- **WHEN** a release begins without required registry credentials or GitHub Release authorization
- **THEN** automation identifies the unavailable prerequisite, does not claim that distribution is published, and reports the overall release as incomplete

### Requirement: Partial releases remain explicit

Failed publication SHALL leave the release incomplete. Automation SHALL NOT retry successful immutable versions under a new version and SHALL report which distributions remain pending.

<!-- focused-spec:id=release.partial-publication -->
#### Scenario: A registry publishes but a later registry fails
- **WHEN** one distribution succeeds and a subsequent registry publication or verification fails
- **THEN** automation preserves the successful immutable artifact, stops dependent publication as appropriate, reports exactly which distributions are published or pending, and never claims full release completion

### Requirement: CLI plugin packages are published only after registry availability is established

Before requiring Python/.NET CLI format and runner packages in the npm release, automation SHALL verify their exact names are available and authorized. Unavailable names SHALL block full-suite completion without substitution; after resolution, all four packages SHALL be version-checked and published.

<!-- focused-spec:id=release.native-cli-plugins -->
#### Scenario: Native CLI plugin names are absent from npm
- **WHEN** the release preflight queries the four Python/.NET format and runner package names and the registry returns not found
- **THEN** the release reports all unavailable names and blocks completion of the full npm suite until ownership/name availability and publication access are resolved

### Requirement: Release test gates are deterministic and do not duplicate repository evidence

Release verification SHALL pin pytest and run full repository Vitest evidence once per invocation. Local test tiers SHALL distinguish Node-only checks from native-toolchain and network-dependent checks. Behavioral tests SHALL be organized by surface and assert structural CLI interaction contracts rather than incidental copy.

<!-- focused-spec:id=release.verification-determinism -->
#### Scenario: Release checks execute deterministic verification once
- **WHEN** the release-check entrypoint executes on a revision
- **THEN** its pinned Python test dependency is used, repository Vitest evidence runs once, and all required native SDK and CLI evidence remains included in the appropriate release gates

### Requirement: Completed active OpenSpec changes are surfaced without lifecycle mutation

Automation SHALL report active OpenSpec changes whose tasks indicate completion. It SHALL leave specifications, task state, and lifecycle unchanged, and SHALL report findings without blocking unrelated local verification.

<!-- focused-spec:id=release.openspec-stale-guard -->
#### Scenario: Completed active changes are reported without lifecycle mutation
- **WHEN** the local guard scans active OpenSpec changes and finds one or more completed task lists
- **THEN** it reports the change paths and completion signal, leaves every change file and lifecycle state unchanged, and points maintainers to the explicit OpenSpec lifecycle workflow
