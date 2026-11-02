# Spec Delta

## MODIFIED Requirements

### Requirement: Official exact framework runners
Vitest/pytest/Go runner packages SHALL report exact selected per-test pass/fail/skip. Missing, ambiguous, unexecuted or malformed outcomes SHALL NOT pass from exit zero. Frameworks SHALL be consumer-owned. Cancellation, timeout or output overflow SHALL terminate owned process trees within a bound on supported platforms. Go discovery SHALL batch by package with exact-one resolution. Pytest SHALL report real outcomes with xdist in project addopts.

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

<!-- focused-spec:id=runner.official.process-tree-cancel -->
#### Scenario: Cancellation terminates the complete framework process tree
- **WHEN** an official Go, Vitest, or pytest invocation is cancelled while a descendant test process remains alive
- **THEN** the runner terminates its owned process tree within a bounded interval and returns no passing result

<!-- focused-spec:id=runner.official.go-discovery-batch -->
#### Scenario: Go discovery batches exact selectors by package
- **WHEN** several distinct Go test selectors in one package are resolved together
- **THEN** discovery runs once for that package and reports exactly one target for each uniquely matching selector, with missing or ambiguous names remaining errors

<!-- focused-spec:id=runner.official.pytest-xdist -->
#### Scenario: Pytest reports selected results with xdist addopts
- **WHEN** pytest configuration enables xdist through addopts and the selected test passes
- **THEN** the runner reports that selected target as pass based on its real executed result instead of treating empty controller-side collection as failure

### Requirement: Consumer-local package resolution
Plugins SHALL resolve from the consuming project, including installed workspaces and public subpaths, using import conditions and public exports. Missing packages/incompatible exports SHALL fail without global/downloaded fallback. Project-file plugins SHALL remain inside the project. Supported Node.js versions SHALL need no experimental `--experimental-import-meta-resolve` flag.

<!-- focused-spec:id=plugin.package.consumer-local -->
#### Scenario: Import-only package subpath is selected locally
- **WHEN** a consumer registers a package subpath exporting only an ESM import entrypoint
- **THEN** its local implementation resolves and executes evidence instead of another installation

<!-- focused-spec:id=plugin.package.stable-resolver -->
#### Scenario: Consumer-local resolution works without experimental flags
- **WHEN** a supported Node.js process resolves an installed plugin package and import-only public subpath without experimental resolver flags
- **THEN** both resolve from the selected consumer project under import conditions, and missing or non-exported packages fail without a global or downloaded fallback
