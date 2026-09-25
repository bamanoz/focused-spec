## MODIFIED Requirements

### Requirement: Validation before selected execution
`run` SHALL strictly validate exactly its selection before starting tests: all discovered scopes without `--scope`, or only the explicitly named scope with it; when `--scenario <id>` is present, only occurrences of that ID in the selected scope(s) SHALL have their scenario shape and evidence strictly validated and resolved. An explicitly requested scope with no matching documents or a selected scenario ID absent from its scope selection SHALL fail before execution. Ownership checks SHALL still verify the selected ID and its revision chain across scopes without resolving unselected evidence. Malformed or unresolved evidence in other scenarios SHALL NOT prevent selected-scenario execution. Without `--scenario`, full-scope validation remains unchanged.

#### Scenario: Unrelated invalid scenario does not block selected run
- **ID**: `validation.scope.unselected-error`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > runs a selected scenario despite unrelated invalid evidence in its scope`
- **WHEN** a selected scenario has valid executable evidence while another scenario in the same scope has malformed, planned, or unresolved evidence
- **THEN** run executes the selected scenario without validating or resolving the unrelated evidence

#### Scenario: Selected scenario retains strict checks
- **ID**: `validation.scope.selected-own-errors`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid selected scenario before execution`
- **WHEN** the selected scenario itself has malformed or planned evidence or an orphan REVISES source
- **THEN** run reports its violation and does not start any tests

#### Scenario: Explicit scope excludes unrelated evidence failures
- **ID**: `validation.scope.selected-only`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > validates only the selected scope evidence`
- **WHEN** a selected scope is structurally valid while an unselected scope contains malformed or unresolved evidence
- **THEN** validation and execution of the selected scope are not blocked by the unrelated evidence
