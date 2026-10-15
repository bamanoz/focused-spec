# Spec Delta

## MODIFIED Requirements

### Requirement: Focused scenario identity
Each enrolled native item SHALL have one opaque stable string ID unique within its scope and identify one independently failing outcome. IDs SHALL retain exact case and value, contain a non-whitespace character and contain no control characters. Separate scopes SHALL independently bind their own items and evidence without ownership, revision ancestry or inheritance. Native formats own representation and escaping.

<!-- focused-spec:id=scenario.identity.duplicate-document -->
#### Scenario: Duplicate identity binds two native items
- **WHEN** two native items in one scope declare the same focused marker ID
- **THEN** validation rejects the duplicate instead of accepting both

<!-- focused-spec:id=scenario.identity.independent-scopes -->
#### Scenario: Independent scopes reuse an identity
- **WHEN** separate scopes bind the same stable ID to their own native items and evidence
- **THEN** validation accepts both independent occurrences

<!-- focused-spec:id=scenario.identity.explicit-evidence -->
#### Scenario: Evidence cannot be inherited
- **WHEN** a selected marked item lacks its own evidence enrollment while another scope registers the same ID
- **THEN** validation rejects the selected occurrence without inheriting evidence

<!-- focused-spec:id=scenario.identity.opaque -->
#### Scenario: Opaque identities retain exact selection semantics
- **WHEN** selected native outcomes declare auth-login, 123, case-distinct, Unicode, spaced or path-looking IDs
- **THEN** binding, CLI selection and results retain each exact value without renaming, normalization or path interpretation

### Requirement: Evidence rows
Each enrolled occurrence SHALL obtain its own explicit nonempty evidence from its selected format. Core SHALL validate normalized references independently of storage syntax or location; it SHALL NOT require, discover or load a YAML evidence registry. References SHALL use [planned:]<runner-id>::<opaque selector>; every reference SHALL be checked and multiple references SHALL form an AND contract.

<!-- focused-spec:id=scenario.evidence.required -->
#### Scenario: Every occurrence needs explicit evidence
- **WHEN** a native marker has no own scope-local evidence
- **THEN** validation rejects that occurrence even when another scope has evidence
- **AND** The explicitly selected registry adapter SHALL accept only a scopes mapping; entries SHALL contain a nonempty evidence list and optional external source mapping containing exactly path and nativeId. Unknown or duplicate fields and behavioral text fields SHALL fail validation. References SHALL use [planned:]<runner-id>::<opaque selector>; every reference SHALL be checked and multiple references form an AND contract.

<!-- focused-spec:id=scenario.evidence.malformed-row -->
#### Scenario: Malformed evidence cannot be hidden by valid evidence
- **WHEN** a registration contains both valid and malformed evidence references
- **THEN** run rejects the malformed reference before execution

<!-- focused-spec:id=scenario.evidence.opaque-selector -->
#### Scenario: Opaque selector keeps internal separators
- **WHEN** a normalized reference contains planned evidence and additional selector separators
- **THEN** only the first separator splits the runner ID and the remaining selector is preserved

<!-- focused-spec:id=native.registry.closed-schema -->
#### Scenario: Duplicate or behavioral registry fields fail
- **WHEN** registry YAML repeats a key or includes an unsupported behavioral field
- **THEN** the registry is rejected rather than treating it as another behavior source

<!-- focused-spec:id=scenario.enrollment.competing -->
#### Scenario: Competing evidence does not merge
- **WHEN** inline and external adapters enroll the same actual native item or two items with the same ID in one selected scope
- **THEN** validation rejects the competing enrollments even when their evidence lists agree, without precedence or execution

### Requirement: Native scenario enrollment
Behavior SHALL remain solely in its native checkable item. Selected formats SHALL own evidence acquisition and native-ID resolution, while core validates normalized enrollment against its discovered catalog. Explicit plain Markdown SHALL NOT infer the inline authoring dialect; explicitly selected inline Markdown SHALL be supported.

<!-- focused-spec:id=scenario.enrollment.mixed-document -->
#### Scenario: Registered evidence beside untouched native content
- **WHEN** a document contains one marked item and unrelated unmarked native content
- **THEN** only the registered item executes and receives a focused result
- **AND** Editable Markdown SHALL bind one heading, paragraph, or list item through an adjacent focused-spec HTML marker placed before the item, or inline at the end of a paragraph/list item. At most one blank line is permitted; intervening structural nodes and larger gaps detach the marker. Markers inside code examples SHALL NOT enroll an item. Gherkin focused tags SHALL bind only Scenario or Scenario Outline, not inherited Feature/Rule/Examples tags. Generated or unmarked items MAY use an explicit registry source.path and source.nativeId declaration; resolution SHALL be unique within that exact configured document, never inferred from headings, lines, or wording. Every selected marker SHALL have its own format-provided evidence and every enrollment SHALL uniquely bind one native item. Inline focused rows SHALL require the explicitly selected inline format and SHALL NOT be a plain-Markdown fallback. Host behavioral meaning and native-format validity SHALL NOT be certified by focused-spec.

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
- **WHEN** a document selected as plain Markdown contains inline focused ID or EVIDENCE rows
- **THEN** validation rejects the unsupported dialect with explicit-format guidance rather than silently interpreting it

<!-- focused-spec:id=native.binding.markdown.trailing -->
#### Scenario: Inline marker must trail the permitted item
- **WHEN** a marker is inline on a heading or precedes later content in the same list item
- **THEN** binding fails while preceding-heading and truly trailing paragraph/list markers remain valid

<!-- focused-spec:id=native.binding.markdown.list-gap -->
#### Scenario: List-contained markers retain actual adjacency
- **WHEN** a standalone marker inside a list is separated from the following paragraph by more than one blank line
- **THEN** binding fails instead of measuring adjacency from the enclosing list start

### Requirement: Normalized format parsing
Format API 2 SHALL return native items, exact normalized evidence and diagnostics while core retains document path and scope. Catalog binding SHALL address actual document/item identities, not source lines. Core SHALL reject malformed or forged results, duplicate enrollments and overlapping opaque source claims before execution. Explicit adapters SHALL support otherwise unknown document extensions.

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

<!-- focused-spec:id=format.contract.storage-independent -->
#### Scenario: Storage-independent adapter enrolls evidence
- **WHEN** a project format acquires evidence without any YAML registry and returns normalized native items and references
- **THEN** core validates, resolves and executes the supplied evidence without inspecting its storage or opening diagnostic origin paths

<!-- focused-spec:id=format.contract.catalog -->
#### Scenario: Catalog binding cannot forge or multiply claim items
- **WHEN** a binder returns an absent document/item, a conflicting marker identity, a forged scope/path or a second enrollment of one item
- **THEN** core fails before evidence runs while distinct valid items sharing source coordinates remain independent

<!-- focused-spec:id=format.contract.source-claims -->
#### Scenario: Overlapping opaque sources fail across adapters
- **WHEN** two selected format adapters claim the same opaque evidence source identity
- **THEN** validation rejects the overlapping claims with their supplied provenance instead of interpreting or merging their storage

<!-- focused-spec:id=format.binding.catalog-errors -->
#### Scenario: External binding sees the whole native catalog
- **WHEN** a registry adapter binds items parsed by different explicit formats, has no own matching documents or finds a selected dangling registration
- **THEN** valid mixed-format enrollments execute and selected dangling registrations fail rather than disappearing with an empty parse set

### Requirement: Bounded isolated format execution
Format parsing and catalog binding SHALL execute outside the CLI process with bounded lifetimes and output. A selected adapter that hangs synchronously, crashes or fails to export its declared interface SHALL produce an actionable violation rather than hanging the CLI or falling back to another parser.

<!-- focused-spec:id=format.lifecycle.timeout -->
#### Scenario: Non-responsive native parser fails closed
- **WHEN** a selected format adapter blocks its host process beyond its configured timeout
- **THEN** validation terminates the host and returns a format violation without execution

<!-- focused-spec:id=format.lifecycle.bind-timeout -->
#### Scenario: Non-responsive evidence binder fails closed
- **WHEN** an API-2 binder blocks its isolated host after document parsing completes
- **THEN** the CLI terminates the host, reports a format violation and starts no evidence execution; existing parse timings remain completed rather than being rewritten as a failed parse
