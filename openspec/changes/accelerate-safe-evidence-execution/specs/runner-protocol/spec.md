## ADDED Requirements

### Requirement: Optional exact execution partition
When bounded concurrent execution is enabled, a participating project-local runner SHALL return executable groups of selected resolved targets and their resource keys. The runner SHALL determine group boundaries and resource claims from its own policy, whether code, runner-owned configuration or another source; the core SHALL depend only on the returned partition, not on that source. The runner SHALL mark groups with unknown compatibility exclusive or report an actionable error rather than assert independence. A runner without the optional partition method SHALL remain a single exclusive invocation and SHALL NOT need a new API version. The host SHALL reject an invalid partition for that runner before invoking any of its groups; each selected target SHALL belong to exactly one nonempty group, and each group SHALL declare either `exclusive: true` or distinct nonempty resource keys. An invalid or failed partition SHALL result in execution errors for that runner's selected targets; other valid runners SHALL still execute. With the default concurrency limit, the host SHALL not invoke partition and SHALL run each runner once as before.

#### Scenario: Runner partitions only selected targets
- **ID**: `runner.partition.selected-targets`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > partitions only selected targets into exact executable groups`
- **WHEN** a runner partitions selected targets into independent groups under an enabled concurrency limit
- **THEN** the host invokes each group with exactly its declared targets and returns one real result per selected target

#### Scenario: Malformed partition blocks only its runner
- **ID**: `runner.partition.invalid`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > rejects an invalid partition without running that runner's targets`
- **WHEN** a runner omits, repeats, invents or puts a selected target into an empty group, or declares a malformed resource key
- **THEN** none of its groups execute and its targets report ERROR rather than PASS

#### Scenario: Existing plugin requires no partition
- **ID**: `runner.partition.legacy-exclusive`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > runs an unmodified runner exclusively with bounded concurrency`
- **WHEN** concurrency is enabled alongside a plugin exporting only resolve and run
- **THEN** the plugin receives all selected targets once and its invocation does not overlap any other group

#### Scenario: Default mode does not partition
- **ID**: `runner.partition.default-serial`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > leaves partition dormant with the default serial limit`
- **WHEN** a plugin with partition is used without opting into concurrent execution
- **THEN** the host calls run once with all its selected targets and does not call partition

#### Scenario: Unknown compatibility remains exclusive
- **ID**: `runner.partition.uncovered-exclusive`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > keeps targets with unknown resource compatibility exclusive`
- **WHEN** a runner cannot establish compatibility for a selected target
- **THEN** it declares that target exclusive or reports an actionable error rather than claiming independent execution
