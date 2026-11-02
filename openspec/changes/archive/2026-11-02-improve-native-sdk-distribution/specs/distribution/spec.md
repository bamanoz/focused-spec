# Spec Delta

## ADDED Requirements

### Requirement: Independent native SDK package metadata
The Python, .NET, and Go SDK distributions SHALL expose the metadata and package contents needed by language-native tooling and consumers, independently of focused-spec CLI plugins.

<!-- focused-spec:id=distribution.native-sdk-metadata -->
#### Scenario: Python package metadata and typing marker are available
- **WHEN** a consumer inspects and installs the built Python wheel or source distribution
- **THEN** it can discover the package license as an SPDX expression, project URLs and relevant classifiers, and the installed SDK includes `py.typed` for PEP 561 typing support

<!-- focused-spec:id=distribution.native-dotnet-targets -->
#### Scenario: NuGet package supports declared .NET target frameworks
- **WHEN** a consumer restores the SDK package for `net8.0` or `net10.0`
- **THEN** NuGet selects a compatible target asset for that framework and the SDK remains usable without focused-spec, parser, or xUnit runtime dependencies

<!-- focused-spec:id=distribution.native-go-version-template -->
#### Scenario: Go example resolves the coordinated module version
- **WHEN** release preparation stamps the Go example module version template with the coordinated SDK release version
- **THEN** a clean Go consumer can resolve that exact immutable module version without a repository-local `replace` directive, while checkout examples may continue using local replacements

### Requirement: Native SDK consumer installation sources are explicit
Consumer documentation SHALL provide reproducible installation instructions for each native SDK. The .NET SDK SHALL be distributed as a verified `.nupkg` asset on the coordinated GitHub Release and installed through a project-local NuGet feed.

<!-- focused-spec:id=distribution.native-python-install -->
#### Scenario: Python consumer installs the published SDK
- **WHEN** a Python consumer follows the SDK installation guide
- **THEN** the documented command installs the public PyPI distribution and the installed package exposes its declared type information

<!-- focused-spec:id=distribution.native-dotnet-install -->
#### Scenario: .NET consumer installs the GitHub Release package
- **WHEN** a consumer follows the .NET SDK installation instructions for a coordinated release
- **THEN** they can download the matching `.nupkg` from that GitHub Release, verify its SHA-256, and install the pinned package from a project-local NuGet feed

<!-- focused-spec:id=distribution.native-dotnet-restore -->
#### Scenario: .NET consumer restores reproducibly from the local feed
- **WHEN** a consumer or CI environment restores a project using the documented GitHub Release package
- **THEN** the matching package is present in the configured local feed before restore, and the instructions preserve existing NuGet sources and source mappings where applicable without treating the GitHub URL as a NuGet HTTP feed

<!-- focused-spec:id=distribution.native-dotnet-reference -->
#### Scenario: CLI reference stays current with the install guide
- **WHEN** a reader follows the CLI reference to .NET SDK installation guidance
- **THEN** it links to the current GitHub Release/local-feed installation guide without presenting a stale pinned version
