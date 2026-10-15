# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit logical registry composition
The explicitly selected registry format SHALL compose one logical evidence registry from its own nonempty list of safe project-relative YAML paths or patterns. It SHALL resolve registrations against the complete native catalog and return normalized evidence; core SHALL NOT load YAML evidence or infer a registry location.

<!-- focused-spec:id=registry.sharding.compose -->
#### Scenario: Domain shards contribute to one logical registry
- **WHEN** explicitly configured domain shards register distinct native items with multiple evidence references
- **THEN** discovery binds all entries and preserves every reference as an AND contract without loading an unconfigured registry
- **AND** An adapter-owned documented default MAY select .focused-spec/evidence.yaml through that adapter’s same loader; omission SHALL NOT create a core fallback. Explicit sources SHALL NOT trigger fallback, nested includes, or implicit repository-wide search. Each source SHALL match at least one YAML file; unsafe configuration, missing sources, unsupported matched extensions, overlapping lexical/canonical claims, and symlink escapes SHALL fail before evidence execution. Files SHALL be loaded deterministically.

<!-- focused-spec:id=registry.sharding.config-safe -->
#### Scenario: Unsafe registry configuration is rejected
- **WHEN** registry-adapter options are empty, contain unknown fields, or declare unsafe source patterns
- **THEN** the selected adapter reports its options error before source discovery

<!-- focused-spec:id=registry.sharding.source-boundaries -->
#### Scenario: Source boundaries are enforced
- **WHEN** configured sources are missing, overlap lexically or canonically, match non-YAML files, or resolve outside the project
- **THEN** registry loading reports the offending source rather than silently dropping or accepting it

### Requirement: Scope-local uniqueness and diagnostic provenance
The selected registry adapter SHALL preserve at most one selected (scope, ID) across its sources, with no merge or last-wins resolution. It SHALL return exact file/line provenance and selection-aware binding diagnostics; core SHALL also reject competing normalized enrollments across adapters.

<!-- focused-spec:id=registry.sharding.duplicates -->
#### Scenario: Cross-file duplicate registrations fail
- **WHEN** two configured files register the same selected scope and ID
- **THEN** loading rejects the duplicate and names both file/line locations
- **AND** The same ID in separate scopes SHALL remain independent. Semantic entry validation and duplicate checks SHALL honor selected scope and ID isolation; source/YAML structural errors SHALL remain errors. Entry and binding diagnostics SHALL name the actual registry file and line; duplicate diagnostics SHALL identify both registrations. Physical file placement SHALL NOT change native binding or semantic identity.

<!-- focused-spec:id=registry.sharding.selection -->
#### Scenario: Scoped selection isolates unrelated semantic errors
- **WHEN** other shard entries have invalid metadata or duplicate identities outside the selected scope and ID
- **THEN** the selected valid occurrence binds independently while full validation reports those errors

<!-- focused-spec:id=registry.sharding.provenance -->
#### Scenario: Binding failure points to its domain shard
- **WHEN** a registration in a configured shard has no unique matching native item
- **THEN** the violation reports that shard's actual path and entry line

### Requirement: Bounded registry source discovery

The selected registry adapter’s source patterns SHALL use the same limits as document patterns: 4096 characters, 32 nested group levels with parentheses limited to 2 levels, 256 brace delimiter characters and 256 expanded alternatives per pattern. Excess SHALL produce an actionable violation without partially loading sources. Bounded alternatives SHALL preserve padded and stepped numeric ranges.

<!-- focused-spec:id=registry.glob.bounds -->
#### Scenario: Excessive registry pattern complexity
- **WHEN** an evidence source exceeds a documented pattern bound
- **THEN** registry loading reports the invalid source without returning a partial registry

### Requirement: Unreadable registry source discovery

The selected registry adapter SHALL report a matched dangling symlink as an unreadable source rather than silently remove it from the registry selection.

<!-- focused-spec:id=registry.source.broken -->
#### Scenario: Dangling registry source link
- **WHEN** a registry source pattern matches a dangling symlink beside a readable shard
- **THEN** loading reports the unreadable source instead of silently accepting incomplete evidence
