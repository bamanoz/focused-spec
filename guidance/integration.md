# Focused Spec Integration

This is the installed core package's offline orientation for choosing a composition for standalone BDD/executable scenarios or existing native requirements, not a plugin manual or permission to change a project. Load the workflow from the same selected installed CLI first. Keep its phase, approval, identity, evidence and verification obligations. No SDD framework is required. Reading this topic installs nothing and proves no behavior.

## Inspect before choosing

Establish the consuming project and dependency-owning workspace, package manager, task phase and authorization. Inspect the authoring process (and host workflow when present), canonical editable or generated behavioral source, existing configuration/enrollments and evidence owners, actual application boundary, tests and runtime prerequisites. Use repository facts before asking; ask only about unresolved alternatives with materially different ownership or authoring consequences.

Preserve supported existing choices for ordinary work. An incompatible configuration follows the workflow's upgrade procedure, not greenfield replacement. A host's name does not select a format. Do not rewrite native acceptance items into another dialect merely because an adapter is familiar. Multiple domains may use different explicit paths, but two adapters must not own the same item.

Choose from the requested behavioral source, not the implementation language. Integrating evidence for an existing native text requirement retains and enrolls that item through compatible formats and test runners. It does not require a language SDK or a native code-discovery plugin: Go and Python tests can be evidence for the same text item. Do not substitute SDK-only scenarios because configuration or plugins are not yet installed; installing and configuring the selected missing capabilities is part of authorized integration. SDK-only is the path for a native code-scenario suite, not an alternative completion claim for an unenrolled text requirement.

## Candidate capabilities

This map is illustrative, nonexclusive and not a compatibility certification. Project-owned and third-party plugins remain eligible through their public contracts. Names provide orientation before optional packages are installed; concrete syntax, options, selectors and composed dependencies belong to each selected package.

| Need | Candidate capabilities |
| --- | --- |
| Existing native Markdown or Gherkin with separate evidence ownership | A registry and compatible native parser; official examples are `@focused-spec/format-registry` with `@focused-spec/format-markdown` or `@focused-spec/format-gherkin` |
| Standalone text scenarios | `@focused-spec/format-inline`, with the runner matching the existing tests |
| Existing test framework | Reuse a compatible installed or project runner first; official examples include `@focused-spec/runner-vitest`, `@focused-spec/runner-pytest`, `@focused-spec/runner-go` |
| Native JavaScript/TypeScript executable scenarios | Independent `@focused-spec/scenarios-typescript`; optionally `@focused-spec/format-scenarios-typescript` and `@focused-spec/runner-scenarios-typescript` for CLI discovery/execution |
| Native Go executable scenarios | Independent Go module `github.com/bamanoz/focused-spec/packages/sdk/go`; optionally `@focused-spec/format-scenarios-go` and `@focused-spec/runner-scenarios-go` for CLI discovery/execution |
| Native Python executable scenarios | Independent Python distribution `focused-spec-scenarios` (`focused_spec_scenarios` import), Python 3.11+; execute directly or through consumer-owned pytest tests |
| Native .NET executable scenarios | Independent NuGet package `FocusedSpec.Scenarios`, .NET 9+; execute directly or through consumer-owned xUnit tests |

Go, Python and .NET SDKs are native distributions, not npm packages. Check their documented distribution and publication prerequisites; do not infer registry availability from a source manifest or invent a successful remote installation. Node, Go, Python 3.11+, .NET 9+ and selected test frameworks remain consumer-owned prerequisites. Selecting any independent SDK for the first time still requires this topic, even if the task explicitly excludes CLI integration. SDK-only execution needs neither focused configuration nor CLI plugins. Native Go/Python/.NET SDK execution also needs no Node; the selected CLI serving this orientation is not an SDK runtime dependency. Native code scenarios are the behavioral source, not tests requiring a Markdown companion or registry.

Python and .NET SDKs currently provide no focused-spec native-discovery format or direct scenario runner. Do not invent `format-scenarios-python`, `runner-scenarios-python`, .NET counterparts, or a bundled xUnit runner. Keep their native execution path unless CLI integration is requested. Python pytest wrappers can then use the existing pytest runner's public exact-selector contract; .NET wrappers require a compatible installed/project runner before CLI binding can be claimed. Neither case authorizes copying the code scenarios into Markdown.

## Install the .NET SDK from a GitHub Release

The coordinated `FocusedSpec.Scenarios` version `0.10.2` uses a public GitHub Release `.nupkg`, not nuget.org. Use this explicit distribution for that SDK version only when the asset is present and matches the checksum below; do not infer registry or asset availability from the CLI version. The SDK requires .NET 9+ but no Microsoft account, GitHub login, Node.js, or focused-spec runtime. This procedure is included here so the installed CLI works without repository documentation. It authorizes no download or project mutation outside the user's installation/implementation scope.

1. Inspect the consuming solution/project, existing `NuGet.Config` hierarchy, package source mapping, package references, and CI restore procedure. Preserve custom sources and mappings. Select a project-owned local feed; the following example uses `.nuget/local-feed` relative to the solution's `NuGet.Config`.
2. When installation is authorized, create that directory and download the pinned public artifact. From the solution root on macOS/Linux:

   ```sh
   mkdir -p .nuget/local-feed
   curl --fail --location --output .nuget/local-feed/FocusedSpec.Scenarios.0.10.2.nupkg \
     https://github.com/bamanoz/focused-spec/releases/download/v0.10.2/FocusedSpec.Scenarios.0.10.2.nupkg
   ```

   On Windows PowerShell:

   ```powershell
   New-Item -ItemType Directory -Force .nuget/local-feed | Out-Null
   Invoke-WebRequest -Uri 'https://github.com/bamanoz/focused-spec/releases/download/v0.10.2/FocusedSpec.Scenarios.0.10.2.nupkg' -OutFile '.nuget/local-feed/FocusedSpec.Scenarios.0.10.2.nupkg'
   ```

3. Verify SHA-256 equals `03e6e38203a27597c3056b55c85d15068c52597fd479d666a2042ff599f4d34b` before installing. Use `shasum -a 256 .nuget/local-feed/FocusedSpec.Scenarios.0.10.2.nupkg` on macOS, `sha256sum` on Linux, or `Get-FileHash -Algorithm SHA256 .nuget/local-feed/FocusedSpec.Scenarios.0.10.2.nupkg` in PowerShell. A missing artifact, failed download, or checksum mismatch blocks this path; do not substitute another version or claim success.
4. Register the directory in project-local `NuGet.Config`. For a new configuration beside `.nuget/`:

   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <packageSources>
       <clear />
       <add key="focused-spec-local" value=".nuget/local-feed" />
       <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
     </packageSources>
   </configuration>
   ```

   For an existing configuration, merge only the local source; never replace custom sources or add `clear`. When source mapping is enabled, map `FocusedSpec.Scenarios` to `focused-spec-local` too. Paths are relative to the configuration file. A GitHub download URL is not a NuGet HTTP feed.
5. From the selected `.csproj` directory, run `dotnet add package FocusedSpec.Scenarios --version 0.10.2` and `dotnet restore`, or pass that project path explicitly. Read the SDK's public README included in the downloaded package for scenario and driver contracts before writing evidence; the CLI's npm `plugin-docs --package` does not acquire native NuGet contracts. Execute a real SDK consumer and check the actual result. Installation alone proves neither application behavior nor CLI integration.
6. Retain `NuGet.Config` and the pinned `PackageReference`. Arrange the same verified download before restore on other machines and CI, or explicitly vendor the `.nupkg` if the project permits it. A global developer cache is insufficient. Verify restore with a fresh `NUGET_PACKAGES` directory and run the consumer. Updates require the matching versioned asset, package reference and verified checksum together; this `0.10.2` recipe does not promise assets for other versions. Report GitHub/local-feed installation separately from nuget.org publication, which remains pending.

## Select, acquire contracts, then integrate

1. Recommend the smallest compatible composition. Identify the retained source, evidence owner, execution path, required packages/prerequisites, and what will deliberately remain uninstalled. Do not add every package or infer a storage conversion from an installation request.
2. Public package documentation may inform preliminary selection before installation. When installation is authorized, use the existing package manager at the established dependency owner. For npm SDKs and CLI plugins, identify the needed package or existing format/runner registration, then acquire its installed public contract through the workflow topic's shared plugin-document procedure with the same selected CLI and explicit consuming-project root. Follow a composing document's named package option with the required separate package-contract request. For native Go/Python/.NET SDKs, read the selected module/distribution/NuGet package's public README and metadata with its origin/version visible; npm `plugin-docs --package` does not resolve those native distributions. Use the project's existing native dependency manager or an authorized local module, Python wheel/editable path, or NuGet feed/project reference. A local artifact proves local use, not registry publication.
3. If the contract is absent or incompatible, reconsider the recommendation or report the precise missing prerequisite. Do not guess syntax, silently change representation, enumerate packages, import implementation, or substitute stale repository instructions. Generated/metadata-hostile sources need a documented stable native identity exposed by their parser; without one binding is unsupported, not a guessed heading or coordinate.
4. Recommendation-only work stops without installation or executable setup. Installation-only work stops after verified core/agent setup, explicitly leaving composition/configuration/evidence pending. Planning records the proposed composition and exact intended evidence in host-permitted artifacts; it does not create executable integration.
5. During authorized implementation, keep the driver on the real application and the expectation independent. When the actual phase permits execution, acquire the `verify` topic through the workflow's same-selected-CLI procedure. For SDK-only work, follow it on the native suite and stop without adding focused configuration or CLI plugins. For requested CLI integration, bind the first in-scope native outcome, verify its exact evidence through that procedure, then execute the completed configured scope. Guidance, discovery, validation, and installation are not execution or coverage.
