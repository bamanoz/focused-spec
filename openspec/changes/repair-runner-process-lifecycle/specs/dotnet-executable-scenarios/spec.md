# Spec Delta

## MODIFIED Requirements

### Requirement: Bounded .NET execution and trustworthy reports
.NET helper/execution input, output and lifetimes SHALL be bounded. Cancellation, timeout, build failure, crash, malformed, duplicate or missing selected results SHALL NOT pass. Cooperative termination SHALL await post-preparation cleanup; forced termination SHALL NOT guarantee it. Bridge builds SHALL preserve consumer NuGet user configuration and global packages location, without restore assets depending on removed temporary directories.

<!-- focused-spec:id=dotnet-runner.transport -->
#### Scenario: A successful build is not a result
- **WHEN** build or execution exits zero without a valid unique selected result, or application output imitates a success report
- **THEN** the selected scenario cannot pass

<!-- focused-spec:id=dotnet-runner.cancellation -->
#### Scenario: Cancellation bounds a hanging typed action
- **WHEN** a prepared .NET action is cancelled but does not finish cooperatively
- **THEN** execution settles nonpassing within the documented termination bound and owned processes do not remain running

<!-- focused-spec:id=dotnet-runner.nuget-state-preserved -->
#### Scenario: Bridge execution preserves consumer restore state
- **WHEN** the bridge runs for a consumer restored with a NuGet package and custom or user-level NuGet configuration
- **THEN** the consumer's NuGet configuration remains in effect, its assets do not reference a removed temporary package cache, and its subsequent `dotnet build --no-restore` succeeds
