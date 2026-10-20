# Spec Delta

## Purpose

Expose enrolled native scenarios and their exact evidence provenance without resolving executable targets or claiming behavioral success.

## ADDED Requirements

### Requirement: Read-only enrollment inventory
`list` SHALL inspect format-provided enrollments using explicit root/config and optional scope/scenario selection. It SHALL parse/bind and validate normalized structure with planned evidence permitted, but SHALL NOT load runners, resolve targets, execute evidence or write project files. Inspection SHALL not claim PASS, native validity or unenrolled coverage.

<!-- focused-spec:id=inspection.list.read-only -->
#### Scenario: Inventory does not resolve or execute evidence
- **WHEN** list selects valid concrete and planned references with a runner that would fail if imported
- **THEN** it succeeds with the enrolled occurrences and exact references without runner import, resolution, execution or project writes

### Requirement: Exact scope-aware lookup
`show <id>` SHALL select the exact opaque ID, retaining case, Unicode and punctuation. Without scope it SHALL return every independently enrolled matching occurrence; with scope it SHALL isolate that occurrence. `show -- <id>` SHALL permit flag-looking IDs. Missing explicit scope/ID SHALL fail, never select an arbitrary occurrence or emit a successful partial inventory.

<!-- focused-spec:id=inspection.show.selection -->
#### Scenario: Lookup preserves exact independent identity
- **WHEN** the same ID occurs in multiple scopes beside case-distinct, Unicode and flag-looking IDs
- **THEN** show returns exactly matching occurrences, honors explicit scope and positional delimiter, and reports absence instead of fuzzy matching

### Requirement: Deterministic reference provenance
Successful inspection SHALL expose selection, scope, exact ID/name, native source path/line and each ordered evidence reference with its supplied source path/line. Per-reference source SHALL take precedence over shared evidence source and native source fallback. Rows SHALL sort by exact scope then ID without case folding or locale normalization. Returned origins SHALL not be opened merely to display them.

<!-- focused-spec:id=inspection.output.provenance -->
#### Scenario: Inline and external evidence retain their origins
- **WHEN** selected formats provide inline evidence, external bindings and multiple references with distinct origins
- **THEN** JSON and text retain the native origin and every exact ordered reference with its correct origin, in deterministic occurrence order

### Requirement: Fail-closed structural inspection
Inspection SHALL use existing discovery and structural-validation boundaries. Configuration, selected binding/identity/reference violations and required structural source failures SHALL produce a failed result with actual selection and violations, without a scenarios inventory. Unrelated semantic entries SHALL remain isolated by explicit selection.

<!-- focused-spec:id=inspection.errors.structural -->
#### Scenario: Invalid selection never produces a usable partial inventory
- **WHEN** inspection encounters a selected malformed reference, duplicate enrollment, missing scope/ID or structural source failure
- **THEN** it exits 1 with `valid: false`, selection and violations, omits scenarios, and does not load a runner
- **AND** an empty all-scope project is a valid empty inventory; unrelated semantic failures do not block a valid selected occurrence
