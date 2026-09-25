# project-configuration Specification

## Purpose

Versioned runner configuration and specification source discovery.

## Requirements

### Requirement: Project configuration
The CLI SHALL load a version-2 `.focused-spec/config.yaml` from the selected project root unless an explicit configuration path is supplied. It SHALL reject invalid document layout settings and runner definitions at the configuration boundary, including obsolete version-1 source modes.

#### Scenario: Missing or invalid configuration
- **ID**: `config.document.invalid`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports missing malformed and unsupported configuration`
- **WHEN** a project has no readable version-2 configuration with document layouts and runners map
- **THEN** validation exits nonzero with an actionable configuration violation

#### Scenario: Runner timeout exceeds the host timer range
- **ID**: `config.runner.timeout-bound`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects runner timeouts that overflow the host timer`
- **WHEN** a runner timeout exceeds 2147482647 milliseconds
- **THEN** configuration is rejected before any overflowing host timer is created

#### Scenario: Unsafe or non-JSON runner configuration
- **ID**: `config.runner.invalid-options`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid runner paths and non JSON options`
- **WHEN** a runner module path escapes the project root or runner options are not JSON-compatible
- **THEN** validation reports a configuration or runner-path error without loading the module

#### Scenario: Invalid scope assignment in document layout
- **ID**: `config.layout.invalid`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unsafe and ambiguous document layouts`
- **WHEN** a document layout has both or neither of an explicit path-safe scope and exactly one unambiguous scope capture
- **THEN** configuration fails before reading or executing documents

### Requirement: Specification sources
The CLI SHALL discover focused scenarios from configured project-relative Markdown document patterns without requiring a named SDD framework. Every pattern SHALL assign exactly one path-safe scope: either an arbitrary explicit `scope: <name>` without `{scope}`, or exactly one `{scope}` capture without an explicit scope. No scope name, including `baseline`, SHALL receive special behavior. Optional per-pattern exclusions SHALL narrow matches without creating fallback locations. Multiple patterns MAY contribute documents to the same scope. A document SHALL belong to exactly one configured location and scope. Configuration SHALL support nested capability specs, a spec adjacent to planning artifacts, and projects whose layouts match no documents. An explicitly requested scope with no matching documents or any discovered scope whose documents contain no focused scenarios SHALL fail. No pattern SHALL be silently widened when a configured location is absent.

#### Scenario: File globs match no specifications
- **ID**: `config.source.empty-files`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** configured document globs match no Markdown specifications and no scope is selected
- **THEN** validation reports zero scenarios, planned evidence, and targets without treating global absence as an error

#### Scenario: Explicit and captured scopes are discovered
- **ID**: `config.source.openspec-discovery`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** one layout explicitly names a scope and another captures a different scope from matching scenario documents
- **THEN** full validation includes both scopes in its reported scenario count without privileging either name

#### Scenario: Adjacent and nested scope layouts
- **ID**: `config.source.layout-variants`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > discovers adjacent and nested scope documents from declared patterns`
- **WHEN** projects configure a document adjacent to planning artifacts or nested under a feature or capability directory
- **THEN** each declared document is discovered in its captured scope without an SDD-specific locator

#### Scenario: Absent selected scope
- **ID**: `config.source.missing-scope`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a selected scope with no documents`
- **WHEN** an explicitly selected scope has no documents matching its configured patterns
- **THEN** validation fails with an actionable missing-scope error rather than reporting an empty success

#### Scenario: Scope document without focused scenarios
- **ID**: `config.source.empty-scope-document`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a selected scope with no focused scenarios`
- **WHEN** the selected scope has Markdown documents but none contain a focused scenario
- **THEN** validation fails rather than treating native prose or zero targets as executable proof

#### Scenario: Overlapping document patterns
- **ID**: `config.source.overlap`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a document claimed by multiple layouts`
- **WHEN** the same document matches multiple configured patterns or would belong to different scopes
- **THEN** discovery fails with its path and conflicting locations instead of silently deduplicating or choosing one
