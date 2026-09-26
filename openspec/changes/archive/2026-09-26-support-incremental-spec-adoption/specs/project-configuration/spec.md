## MODIFIED Requirements

### Requirement: Specification sources
The CLI SHALL discover focused scenarios from configured project-relative Markdown document patterns without requiring a named SDD framework. Every pattern SHALL assign exactly one path-safe scope: either an arbitrary explicit `scope: <name>` without `{scope}`, or exactly one `{scope}` capture without an explicit scope. No scope name, including `baseline`, SHALL receive special behavior. Optional per-pattern exclusions SHALL narrow matches without creating fallback locations. Multiple patterns MAY contribute documents to the same scope. A document SHALL belong to exactly one configured location and scope. Configuration SHALL support nested capability specs, a spec adjacent to planning artifacts, and projects whose layouts match no documents. Configured documents and scopes MAY contain only unenrolled native scenarios alongside other scopes containing enrolled scenarios. An explicitly requested scope with no matching documents or no enrolled focused scenarios SHALL fail. If documents match an all-scope selection but none has an enrolled focused scenario, validation and execution SHALL fail rather than reporting executable coverage. No pattern SHALL be silently widened when a configured location is absent.

#### Scenario: File globs match no specifications
- **ID**: `config.source.empty-files`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** configured document globs match no Markdown specifications and no scope is selected
- **THEN** validation reports zero scenarios, planned evidence, and targets without treating global absence as an error

#### Scenario: Explicit and captured scopes are discovered
- **ID**: `config.source.openspec-discovery`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports all scenarios, planned evidence, and unique resolved targets`
- **WHEN** one layout explicitly names a scope and another captures a different scope from matching scenario documents
- **THEN** full validation includes both scopes in its reported scenario count without privileging either name

#### Scenario: Adjacent and nested scope layouts
- **ID**: `config.source.layout-variants`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > discovers adjacent and nested scope documents from declared patterns`
- **WHEN** projects configure a document adjacent to planning artifacts or nested under a feature or capability directory
- **THEN** each declared document is discovered in its captured scope without an SDD-specific locator

#### Scenario: Absent selected scope
- **ID**: `config.source.missing-scope`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a selected scope with no documents`
- **WHEN** an explicitly selected scope has no documents matching its configured patterns
- **THEN** validation fails with an actionable missing-scope error rather than reporting an empty success

#### Scenario: Scope document without focused scenarios
- **ID**: `config.source.empty-scope-document`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a selected scope with no focused scenarios`
- **WHEN** the explicitly selected scope has Markdown documents but none contain an enrolled focused scenario
- **THEN** validation fails rather than treating native prose or zero targets as executable proof

#### Scenario: Overlapping document patterns
- **ID**: `config.source.overlap`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects a document claimed by multiple layouts`
- **WHEN** the same document matches multiple configured patterns or would belong to different scopes
- **THEN** discovery fails with its path and conflicting locations instead of silently deduplicating or choosing one

#### Scenario: Legacy-only scope beside enrolled scope
- **ID**: `config.source.mixed-scope-enrollment`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs enrolled scope without excluding legacy-only scope`
- **WHEN** all-scope execution discovers a legacy-only scope and a different scope with executable enrolled scenarios
- **THEN** it executes only enrolled scenarios without excluding the legacy-only scope or reporting its native outcomes as passed

#### Scenario: All discovered documents are legacy-only
- **ID**: `config.source.legacy-only-selection`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > refuses to claim coverage when all discovered documents are legacy-only`
- **WHEN** configured globs discover native scenarios but no enrolled scenarios anywhere and no scope is selected
- **THEN** validation and run fail with an actionable no-enrolled-scenarios error rather than reporting executable success
