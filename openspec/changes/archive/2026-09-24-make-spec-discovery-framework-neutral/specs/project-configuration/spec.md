## MODIFIED Requirements

### Requirement: Project configuration
The CLI SHALL load a version-2 `.focused-spec/config.yaml` from the selected project root unless an explicit configuration path is supplied. It SHALL reject invalid document layout settings and runner definitions at the configuration boundary, including obsolete version-1 source modes.

#### Scenario: Missing or invalid configuration
- **ID**: `config.document.invalid`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports missing malformed and unsupported configuration`
- **WHEN** a project has no readable version-2 configuration with document layouts and runners map
- **THEN** validation exits nonzero with an actionable configuration violation

#### Scenario: Runner timeout exceeds the host timer range
- **ID**: `config.runner.timeout-bound`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects runner timeouts that overflow the host timer`
- **WHEN** a runner timeout exceeds 2147482647 milliseconds
- **THEN** configuration is rejected before any overflowing host timer is created

#### Scenario: Unsafe or non-JSON runner configuration
- **ID**: `config.runner.invalid-options`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid runner paths and non JSON options`
- **WHEN** a runner module path escapes the project root or runner options are not JSON-compatible
- **THEN** validation reports a configuration or runner-path error without loading the module

#### Scenario: Unsafe or ambiguous document layout
- **ID**: `config.layout.invalid`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects unsafe and ambiguous document layouts`
- **WHEN** a document pattern escapes the project root, captures a scope ambiguously, or includes a non-Markdown artifact
- **THEN** configuration fails before reading or executing documents

### Requirement: Specification sources
The CLI SHALL discover focused scenarios from configured project-relative Markdown document patterns, without requiring a named SDD framework. A baseline pattern has no scope capture; a named-scope pattern captures one scope name. Optional per-pattern exclusions SHALL narrow matches without creating fallback locations. Multiple patterns MAY contribute documents to the same scope. A document SHALL belong to exactly one configured location and scope. Configuration SHALL support nested capability specs, a spec adjacent to planning artifacts, and frameworks with no baseline documents. A requested scope with no matching documents or any discovered named scope whose documents contain no focused scenarios SHALL fail. No pattern SHALL be silently widened when a configured scope does not match.

#### Scenario: File globs match no specifications
- **ID**: `config.source.empty-files`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** baseline-only document globs match no Markdown specifications and no scope is selected
- **THEN** validation reports zero scenarios, planned evidence, and targets without treating absence as an error

#### Scenario: Baseline and named scope are discovered
- **ID**: `config.source.openspec-discovery`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** baseline documents and one named scope each contain focused scenarios under configured patterns
- **THEN** full validation includes both sets in its reported scenario count

#### Scenario: Adjacent and nested scope layouts
- **ID**: `config.source.layout-variants`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > discovers adjacent and nested scope documents from declared patterns`
- **WHEN** projects configure a document adjacent to planning artifacts or nested under a feature or capability directory
- **THEN** each declared document is discovered in its own named scope without an SDD-specific locator

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
