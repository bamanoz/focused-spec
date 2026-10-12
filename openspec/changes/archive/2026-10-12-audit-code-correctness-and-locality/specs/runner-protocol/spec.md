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

<!-- focused-spec:id=runner.lifecycle.inherited-pipes -->
#### Scenario: Timeout settles despite inherited output pipes
- **WHEN** a timed-out runner leaves a descendant holding its output pipes open
- **THEN** the host terminates and the invocation reports bounded ERROR without blocking unrelated work

<!-- focused-spec:id=runner.lifecycle.malformed-envelope -->
#### Scenario: Malformed host messages fail normally
- **WHEN** a runner sends a null, array or nonboolean success discriminator as its host response
- **THEN** the invocation reports an ordinary ERROR without crashing the caller

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
