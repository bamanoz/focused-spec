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

<!-- focused-spec:id=runner.lifecycle.inherited-pipes -->
#### Scenario: Timeout settles despite inherited output pipes
- **WHEN** a timed-out runner leaves a descendant holding its output pipes open
- **THEN** the host terminates and the invocation reports bounded ERROR without blocking unrelated work

<!-- focused-spec:id=runner.lifecycle.malformed-envelope -->
#### Scenario: Malformed host messages fail normally
- **WHEN** a runner sends a null, array or nonboolean success discriminator as its host response
- **THEN** the invocation reports an ordinary ERROR without crashing the caller

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

<!-- focused-spec:id=runner.run.vitest-exact -->
#### Scenario: Vitest selection retains exact task identity
- **WHEN** distinct Vitest task paths flatten to the same spaced name or a literal title contains the hierarchy delimiter
- **THEN** only the selected task executes and its real result is reported

<!-- focused-spec:id=runner.run.utf8-stream -->
#### Scenario: Unicode survives arbitrary output chunk boundaries
- **WHEN** a framework process splits a multibyte Unicode character across output chunks
- **THEN** resolution and execution preserve the complete character on stdout and stderr

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


### Requirement: Supported-runtime source execution
The official Vitest runner SHALL resolve and execute exact selected evidence when loaded from its TypeScript source on every supported Node.js version, including 22.16.0, without caller-provided type-stripping flags. Compiled package execution SHALL retain the same selected outcomes.

<!-- focused-spec:id=runner.official.source-runtime -->
#### Scenario: Source runner launches its helper on the minimum Node runtime
- **WHEN** the source-mode Vitest runner selects passing and failing tests on Node.js 22.16.0 without ambient type-stripping flags
- **THEN** it resolves the exact tests and reports their actual independent outcomes instead of failing to load its helper

### Requirement: Optional structured execution events
Runner API 1 target results SHALL optionally carry ordered events with nonblank string kind and message and optional JSON-compatible data. Kind SHALL be producer-defined: core SHALL NOT restrict kinds or interpret their meaning. Existing plugins omitting events SHALL retain unchanged status and cardinality semantics.

<!-- focused-spec:id=runner.events.optional -->
#### Scenario: Event-capable and existing runners coexist
- **WHEN** one selected runner reports its own event kinds, including a record named truncated followed by another event, and another reports only its existing target status
- **THEN** both actual outcomes reach the caller, all supplied generic events remain ordered, and no events are invented for the other target

### Requirement: Invalid event reports do not become evidence
An explicitly supplied event list SHALL satisfy the generic event envelope, including nonblank kind and message, optional JSON-compatible data and no unknown envelope fields. Every supplied record SHALL be validated, including any omitted suffix. Invalid reports SHALL yield runner ERROR, not a claimed pass; unrelated invocations SHALL remain independent.

<!-- focused-spec:id=runner.events.invalid -->
#### Scenario: A malformed event prevents a claimed pass
- **WHEN** a runner reports pass with missing or invalid envelope fields or non-JSON data, even after the retained prefix
- **THEN** its invocation reports ERROR with an actionable diagnostic rather than returning that target as passing evidence

### Requirement: Event retention is explicitly bounded
Retained target events SHALL have documented count and encoded-byte bounds. Overflow SHALL preserve an ordered prefix and append an explicit truncation notice within those bounds without altering the target's status. A producer-defined kind SHALL NOT stop collection or make subsequent valid events invalid.

<!-- focused-spec:id=runner.events.bounded -->
#### Scenario: A verbose target remains bounded without a hidden loss of detail
- **WHEN** a correctly executed target emits more events or larger values than its retention budget permits
- **THEN** its result retains a bounded ordered prefix and a visible truncation marker while preserving its actual status

### Requirement: Direct runners retain events on verification failure
Both direct scenario runners SHALL retain already collected events in their target report when SDK verification returns a mismatch or application error. Explanations and observations SHALL NOT determine pass status. An unexecuted action or missing final report SHALL NOT gain fabricated Actual events or a passing outcome.

<!-- focused-spec:id=runner.events.failed-target -->
#### Scenario: An explained wrong bank observation remains a failure
- **WHEN** a selected bank action explains its branch but returns an incorrect observation through either direct runner
- **THEN** the target fails and its report retains the available inputs, explanation and actual observation alongside the verification diagnostic

### Requirement: Runner responses survive transport without repair
Runner responses SHALL be JSON-compatible before transport. Nonfinite numbers, undefined values, functions, symbols, sparse arrays, cyclic values, accessors and non-JSON objects SHALL fail the invocation rather than being removed, coerced or replaced during serialization. Valid JSON payloads SHALL retain their exact values in resolve, partition and run responses. Receiver-side shape and cardinality validation SHALL remain enforced.

<!-- focused-spec:id=runner.response.lossless -->
#### Scenario: Invalid runner data cannot become passing evidence
- **WHEN** a selected runner returns values that JSON transport would silently remove or transform during resolution, partitioning or execution
- **THEN** its invocation fails without claiming PASS or executing rejected resolution or partition results, while a valid JSON response still executes with its original data
