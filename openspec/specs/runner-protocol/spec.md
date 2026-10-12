# runner-protocol Specification

## Purpose

Project-local plugin invocation and exact target resolution and execution responses.

## Requirements

### Requirement: Project-local runner invocation
The CLI SHALL load a registered project-installed package or project-relative `.ts`, `.mts`, `.js` or `.mjs` plugin in a child process and supply its project root, cwd, runner ID, JSON-compatible options and abort signal. A TypeScript plugin SHALL execute on supported Node.js versions without requiring consumers to supply a Node flag. A plugin SHALL default-export `apiVersion: 1` with `resolve` and `run`.

<!-- focused-spec:id=runner.lifecycle.real-invocation -->
#### Scenario: Registered plugin resolves and executes evidence
- **WHEN** an existing project-local plugin is selected by a scenario reference
- **THEN** its resolved target is executed through the isolated runner host and its result reaches the caller

<!-- focused-spec:id=runner.lifecycle.timeout -->
#### Scenario: Runner exceeds its timeout
- **WHEN** a project-local runner does not respond before its configured timeout
- **THEN** the host terminates it and reports an error rather than a passing result

### Requirement: Exact selector resolution
Each requested selector SHALL resolve to exactly one validated target or one actionable resolution error. A target SHALL preserve the exact selector, stable target ID, and project-relative source location when present.

<!-- focused-spec:id=runner.resolve.unresolved -->
#### Scenario: Unresolved selector blocks validation
- **WHEN** a runner reports that a requested selector has no target
- **THEN** validation reports its evidence and the CLI does not begin execution

<!-- focused-spec:id=runner.resolve.cardinality -->
#### Scenario: Duplicate or unknown resolution response
- **WHEN** a runner omits a selector, duplicates its resolution, or returns an unrequested selector
- **THEN** the host rejects the response rather than inventing or silently dropping a target

<!-- focused-spec:id=runner.resolve.source-boundary -->
#### Scenario: Runner reports a source outside the project
- **WHEN** a resolved target reports an absolute or parent-escaping source path
- **THEN** the host rejects that target with an actionable error

### Requirement: Exact execution response
For every requested target the runner SHALL return exactly one `pass`, `fail` or `skip` result. The host SHALL reject duplicate, unknown, missing or malformed target results.

<!-- focused-spec:id=runner.run.cardinality -->
#### Scenario: Missing or duplicate target result
- **WHEN** a runner returns no result for a requested target or repeats a target ID
- **THEN** execution reports an error rather than success for the affected evidence

### Requirement: Optional exact execution partition
When bounded concurrent execution is enabled, a participating project-local runner SHALL return executable groups of selected resolved targets and their resource keys.


<!-- focused-spec:id=runner.partition.selected-targets -->
#### Scenario: Runner partitions only selected targets
- **WHEN** a runner partitions selected targets into independent groups under an enabled concurrency limit
- **THEN** the host invokes each group with exactly its declared targets and returns one real result per selected target
- **AND** The runner SHALL determine group boundaries and resource claims from its own policy, whether code, runner-owned configuration or another source; the core SHALL depend only on the returned partition, not on that source. The runner SHALL mark groups with unknown compatibility exclusive or report an actionable error rather than assert independence. A runner without the optional partition method SHALL remain a single exclusive invocation and SHALL NOT need a new API version. The host SHALL reject an invalid partition for that runner before invoking any of its groups; each selected target SHALL belong to exactly one nonempty group, and each group SHALL declare either `exclusive: true` or distinct nonempty resource keys. An invalid or failed partition SHALL result in execution errors for that runner's selected targets; other valid runners SHALL still execute. With the default concurrency limit, the host SHALL not invoke partition and SHALL run each runner once as before.

<!-- focused-spec:id=runner.partition.invalid -->
#### Scenario: Malformed partition blocks only its runner
- **WHEN** a runner omits, repeats, invents or puts a selected target into an empty group, or declares a malformed resource key
- **THEN** none of its groups execute and its targets report ERROR rather than PASS

<!-- focused-spec:id=runner.partition.legacy-exclusive -->
#### Scenario: Existing plugin requires no partition
- **WHEN** concurrency is enabled alongside a plugin exporting only resolve and run
- **THEN** the plugin receives all selected targets once and its invocation does not overlap any other group

<!-- focused-spec:id=runner.partition.default-serial -->
#### Scenario: Default mode does not partition
- **WHEN** a plugin with partition is used without opting into concurrent execution
- **THEN** the host calls run once with all its selected targets and does not call partition

<!-- focused-spec:id=runner.partition.uncovered-exclusive -->
#### Scenario: Unknown compatibility remains exclusive
- **WHEN** a runner cannot establish compatibility for a selected target
- **THEN** it declares that target exclusive or reports an actionable error rather than claiming independent execution

### Requirement: Consumer-local package resolution
Package plugins SHALL resolve from the selected consuming project, including installed workspace packages and public subpaths. Missing packages and incompatible exports SHALL fail without global or downloaded fallback. Project-file plugins SHALL remain inside the project.

<!-- focused-spec:id=plugin.package.consumer-local -->
#### Scenario: Import-only package subpath is selected locally
- **WHEN** a consumer registers a package subpath exporting only an ESM import entrypoint
- **THEN** its local implementation resolves and executes evidence instead of another installation

### Requirement: Official exact framework runners
Separately installed Vitest, pytest and Go runners SHALL collect exact selected targets and return actual per-test pass, fail or skip outcomes. Missing, ambiguous, unexecuted or malformed outcomes SHALL never become pass solely because a process exits zero. Test frameworks SHALL remain consumer-owned dependencies.

<!-- focused-spec:id=runner.official.vitest -->
#### Scenario: Vitest selected results remain independent
- **WHEN** selected Vitest tests include passing, failing and skipped cases beside an unselected failing test
- **THEN** the runner reports each selected outcome and does not execute the unselected test

<!-- focused-spec:id=runner.official.pytest -->
#### Scenario: Pytest reports concrete test outcomes
- **WHEN** exact pytest node IDs select passing, failing and skipped cases
- **THEN** the runner reports their actual outcomes and rejects a selector matching multiple cases

<!-- focused-spec:id=runner.official.go -->
#### Scenario: Go reports concrete test events
- **WHEN** selected Go tests pass, fail or skip and a collected test disappears before execution
- **THEN** the runner reports real test events and never treats a missing test as passing
