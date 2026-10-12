# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
