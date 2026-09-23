## ADDED Requirements

### Requirement: Project-local runner invocation
The CLI SHALL load a registered project-local `.ts`, `.mts`, `.js` or `.mjs` plugin in a child process and supply its project root, cwd, runner ID, JSON-compatible options and abort signal. A plugin SHALL default-export `apiVersion: 1` with `resolve` and `run`.

#### Scenario: Registered plugin resolves and executes evidence
- **ID**: `runner.lifecycle.real-invocation`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > resolve and execute exact evidence through an isolated runner host`
- **WHEN** an existing project-local plugin is selected by a scenario reference
- **THEN** its resolved target is executed through the isolated runner host and its result reaches the caller

#### Scenario: Runner exceeds its timeout
- **ID**: `runner.lifecycle.timeout`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > reports an unresponsive runner as an error after timeout`
- **WHEN** a project-local runner does not respond before its configured timeout
- **THEN** the host terminates it and reports an error rather than a passing result

### Requirement: Exact selector resolution
Each requested selector SHALL resolve to exactly one validated target or one actionable resolution error. A target SHALL preserve the exact selector, stable target ID, and project-relative source location when present.

#### Scenario: Unresolved selector blocks validation
- **ID**: `runner.resolve.unresolved`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > attributes an unselected scenario error to validation before execution`
- **WHEN** a runner reports that a requested selector has no target
- **THEN** validation reports its evidence and the CLI does not begin execution

#### Scenario: Duplicate or unknown resolution response
- **ID**: `runner.resolve.cardinality`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > rejects duplicate missing and unknown selector resolutions`
- **WHEN** a runner omits a selector, duplicates its resolution, or returns an unrequested selector
- **THEN** the host rejects the response rather than inventing or silently dropping a target

#### Scenario: Runner reports a source outside the project
- **ID**: `runner.resolve.source-boundary`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > rejects a resolved source outside the project root`
- **WHEN** a resolved target reports an absolute or parent-escaping source path
- **THEN** the host rejects that target with an actionable error

### Requirement: Exact execution response
For every requested target the runner SHALL return exactly one `pass`, `fail` or `skip` result. The host SHALL reject duplicate, unknown, missing or malformed target results.

#### Scenario: Missing or duplicate target result
- **ID**: `runner.run.cardinality`
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > rejects missing duplicate and unknown target results`
- **WHEN** a runner returns no result for a requested target or repeats a target ID
- **THEN** execution reports an error rather than success for the affected evidence
