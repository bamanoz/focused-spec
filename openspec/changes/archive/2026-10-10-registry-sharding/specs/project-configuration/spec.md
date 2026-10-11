## MODIFIED Requirements

### Requirement: Specification sources
The CLI SHALL discover focused scenarios from configured project-relative Markdown and Gherkin document patterns without requiring a named SDD framework. Every pattern SHALL assign exactly one path-safe scope: either an arbitrary explicit `scope: <name>` without `{scope}`, or exactly one `{scope}` capture without an explicit scope. No scope name, including `baseline`, SHALL receive special behavior. Optional per-pattern exclusions SHALL narrow matches without creating fallback locations. Multiple patterns MAY contribute documents to the same scope. A document SHALL belong to exactly one configured location and scope. A required logical evidence registry SHALL bind every registered native item. Optional evidence.files SHALL explicitly select project-relative YAML files or patterns; omission SHALL select .focused-spec/evidence.yaml through the same loader. Configuration SHALL support nested capability specs, a spec adjacent to planning artifacts, and projects whose layouts match no documents. Configured documents and scopes MAY contain only unenrolled native scenarios alongside other scopes containing enrolled scenarios. An explicitly requested scope with no matching documents or no registered native items SHALL fail. If documents match an all-scope selection but none has an registered native item, validation and execution SHALL fail rather than reporting executable coverage. No pattern SHALL be silently widened when a configured location is absent.

<!-- focused-spec:id=config.source.empty-files -->
#### Scenario: File globs match no specifications
- **WHEN** configured document globs match no native specifications and no scope is selected
- **THEN** validation reports zero scenarios, planned evidence, and targets without treating global absence as an error

<!-- focused-spec:id=config.source.openspec-discovery -->
#### Scenario: Explicit and captured scopes are discovered
- **WHEN** one layout explicitly names a scope and another captures a different scope from matching scenario documents
- **THEN** full validation includes both scopes in its reported scenario count without privileging either name

<!-- focused-spec:id=config.source.layout-variants -->
#### Scenario: Adjacent and nested scope layouts
- **WHEN** projects configure a document adjacent to planning artifacts or nested under a feature or capability directory
- **THEN** each declared document is discovered in its captured scope without an SDD-specific locator

<!-- focused-spec:id=config.source.missing-scope -->
#### Scenario: Absent selected scope
- **WHEN** an explicitly selected scope has no documents matching its configured patterns
- **THEN** validation fails with an actionable missing-scope error rather than reporting an empty success

<!-- focused-spec:id=config.source.empty-scope-document -->
#### Scenario: Scope document without focused scenarios
- **WHEN** the explicitly selected scope has Markdown documents but none contain an registered native item
- **THEN** validation fails rather than treating native prose or zero targets as executable proof

<!-- focused-spec:id=config.source.overlap -->
#### Scenario: Overlapping document patterns
- **WHEN** the same document matches multiple configured patterns or would belong to different scopes
- **THEN** discovery fails with its path and conflicting locations instead of silently deduplicating or choosing one

<!-- focused-spec:id=config.source.mixed-scope-enrollment -->
#### Scenario: Unmarked native scope beside registered scope
- **WHEN** all-scope execution discovers a unmarked-native scope and a different scope with executable enrolled scenarios
- **THEN** it executes only registered items without reporting unrelated native content as passed

<!-- focused-spec:id=config.source.legacy-only-selection -->
#### Scenario: All discovered documents are unmarked-native
- **WHEN** configured globs discover native scenarios but no enrolled scenarios anywhere and no scope is selected
- **THEN** validation and run fail with an actionable no-registered-items error rather than reporting executable success
