# Spec Delta

## MODIFIED Requirements

### Requirement: Native scenario enrollment
Behavior SHALL remain solely in the host native checkable item.


<!-- focused-spec:id=scenario.enrollment.mixed-document -->
#### Scenario: Registered evidence beside untouched native content
- **WHEN** a document contains one marked item and unrelated unmarked native content
- **THEN** only the registered item executes and receives a focused result
- **AND** Editable Markdown SHALL bind one heading, paragraph, or list item through an adjacent focused-spec HTML marker placed before the item, or inline at the end of a paragraph/list item. At most one blank line is permitted; intervening structural nodes and larger gaps detach the marker. Markers inside code examples SHALL NOT enroll an item. Gherkin focused tags SHALL bind only Scenario or Scenario Outline, not inherited Feature/Rule/Examples tags. Generated or unmarked items MAY use an explicit registry source.path and source.nativeId declaration; resolution SHALL be unique within that exact configured document, never inferred from headings, lines, or wording. Every marker SHALL have a registry entry and every registration SHALL uniquely bind one native item. Obsolete inline focused rows SHALL be rejected. Host behavioral meaning and native-format validity SHALL NOT be certified by focused-spec.

<!-- focused-spec:id=native.binding.markdown.heading -->
#### Scenario: Marker binds the following native heading
- **WHEN** a focused marker is adjacent to a native Markdown heading
- **THEN** parsing binds its stable ID without requiring duplicate focused prose

<!-- focused-spec:id=native.binding.markdown.items -->
#### Scenario: Paragraph and list-item binding
- **WHEN** markers identify native paragraphs and list items
- **THEN** each marker binds its own structural item

<!-- focused-spec:id=native.binding.markdown.detached -->
#### Scenario: Detached and conflicting markers fail
- **WHEN** markers are detached or multiple markers claim one item
- **THEN** parsing reports the binding violation

<!-- focused-spec:id=native.binding.markdown.fenced -->
#### Scenario: Literal marker examples do not enroll
- **WHEN** a fenced code block contains marker-looking text
- **THEN** the literal example is not bound as native behavior

<!-- focused-spec:id=native.binding.gherkin.tags -->
#### Scenario: Gherkin scenario-local identity
- **WHEN** focused tags attach to scenarios or inherited host containers
- **THEN** scenario tags bind and inherited container tags fail

<!-- focused-spec:id=native.binding.gherkin.selected-error -->
#### Scenario: Selected identity retains inherited-tag errors
- **WHEN** an inherited Gherkin focused tag declares the selected ID while another inherited tag declares only an unrelated ID
- **THEN** the selected ID's invalid tag blocks execution while unrelated IDs remain isolated until full validation

<!-- focused-spec:id=native.binding.external.unique -->
#### Scenario: Explicit generated native IDs resolve uniquely
- **WHEN** external registration names a declared native ID in one configured document
- **THEN** the unique item executes while absent or duplicate declarations fail

<!-- focused-spec:id=native.binding.registry.dangling -->
#### Scenario: Registration cannot outlive its item
- **WHEN** a registry entry has no matching native marker
- **THEN** validation fails rather than executing detached evidence

<!-- focused-spec:id=native.binding.obsolete.inline -->
#### Scenario: Legacy rows are not a fallback
- **WHEN** a document contains legacy focused ID or EVIDENCE rows
- **THEN** validation rejects the obsolete format instead of interpreting it

<!-- focused-spec:id=native.binding.markdown.trailing -->
#### Scenario: Inline marker must trail the permitted item
- **WHEN** a marker is inline on a heading or precedes later content in the same list item
- **THEN** binding fails while preceding-heading and truly trailing paragraph/list markers remain valid

<!-- focused-spec:id=native.binding.markdown.list-gap -->
#### Scenario: List-contained markers retain actual adjacency
- **WHEN** a standalone marker inside a list is separated from the following paragraph by more than one blank line
- **THEN** binding fails instead of measuring adjacency from the enclosing list start

### Requirement: Normalized format parsing
Explicit format adapters SHALL return native structural names, positive line locations, direct focused IDs, explicit native IDs and diagnostics without taking ownership of document scope or path. The core SHALL validate returned data before binding evidence. Unknown document extensions SHALL be usable through an explicitly selected adapter.

<!-- focused-spec:id=format.contract.normalized -->
#### Scenario: Third-party native format binds evidence
- **WHEN** a project-relative format adapter parses a document with an extension unknown to the core
- **THEN** its normalized native item binds and executes registered evidence in the core-owned scope

<!-- focused-spec:id=format.contract.malformed -->
#### Scenario: Invalid format results cannot bind evidence
- **WHEN** an adapter returns malformed items, invalid IDs or diagnostics
- **THEN** the core reports a format error without inventing items or executing evidence

<!-- focused-spec:id=format.contract.same-line -->
#### Scenario: Distinct native items share diagnostic coordinates
- **WHEN** an adapter returns two distinct native items on the same source line with independent bindings
- **THEN** both bind and execute while two registrations claiming the same actual item fail
