## MODIFIED Requirements

### Requirement: Focused scenario identity
Each bound native item SHALL have one lowercase dotted stable ID unique within its scope and SHALL identify one independently failing outcome. The same ID MAY occur independently in separate scopes, but every occurrence SHALL bind its own item and declare its own evidence without ownership, revision links, ancestry inference, or evidence inheritance.

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
- **WHEN** a selected marked item lacks its own registration while another scope registers the same ID
- **THEN** validation rejects the selected occurrence without inheriting evidence

### Requirement: Evidence rows
Evidence SHALL live only in the required .focused-spec/evidence.yaml registry, keyed by scope and stable ID. The registry SHALL contain only a scopes mapping; entries SHALL contain a nonempty evidence list and optional external source mapping containing exactly path and nativeId. Unknown or duplicate fields and behavioral text fields SHALL fail validation. References SHALL use [planned:]<runner-id>::<opaque selector>; every reference SHALL be checked and multiple references form an AND contract.

<!-- focused-spec:id=scenario.evidence.required -->
#### Scenario: Every occurrence needs explicit evidence
- **WHEN** a native marker has no own scope-local registry evidence
- **THEN** validation rejects that occurrence even when another scope has evidence

<!-- focused-spec:id=scenario.evidence.malformed-row -->
#### Scenario: Malformed evidence cannot be hidden by valid evidence
- **WHEN** a registration contains both valid and malformed evidence references
- **THEN** run rejects the malformed reference before execution

<!-- focused-spec:id=scenario.evidence.opaque-selector -->
#### Scenario: Opaque selector keeps internal separators
- **WHEN** a registry reference contains planned evidence and additional selector separators
- **THEN** only the first separator splits the runner ID and the remaining selector is preserved

<!-- focused-spec:id=native.registry.closed-schema -->
#### Scenario: Duplicate or behavioral registry fields fail
- **WHEN** registry YAML repeats a key or includes an unsupported behavioral field
- **THEN** the registry is rejected rather than treating it as another behavior source

### Requirement: Native scenario enrollment
Behavior SHALL remain solely in the host native checkable item. Editable Markdown SHALL bind one heading, paragraph, or list item through an adjacent focused-spec HTML marker placed before the item, or inline at the end of a paragraph/list item. At most one blank line is permitted; intervening structural nodes and larger gaps detach the marker. Markers inside code examples SHALL NOT enroll an item. Gherkin focused tags SHALL bind only Scenario or Scenario Outline, not inherited Feature/Rule/Examples tags. Generated or unmarked items MAY use an explicit registry source.path and source.nativeId declaration; resolution SHALL be unique within that exact configured document, never inferred from headings, lines, or wording. Every marker SHALL have a registry entry and every registration SHALL uniquely bind one native item. Obsolete inline focused rows SHALL be rejected. Host behavioral meaning and native-format validity SHALL NOT be certified by focused-spec.

<!-- focused-spec:id=scenario.enrollment.mixed-document -->
#### Scenario: Registered evidence beside untouched native content
- **WHEN** a document contains one marked item and unrelated unmarked native content
- **THEN** only the registered item executes and receives a focused result

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
