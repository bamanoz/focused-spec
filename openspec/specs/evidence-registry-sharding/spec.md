# evidence-registry-sharding Specification

## Purpose

Explicit domain-owned YAML files compose one evidence registry without changing scope-local identity or evidence semantics.

## Requirements

### Requirement: Explicit logical registry composition
The CLI SHALL compose one logical evidence registry from optional version-3 evidence.files, a nonempty list of safe project-relative YAML paths or glob patterns.

<!-- focused-spec:id=registry.sharding.compose -->
#### Scenario: Domain shards contribute to one logical registry
- **WHEN** explicitly configured domain shards register distinct native items with multiple evidence references
- **THEN** discovery binds all entries and preserves every reference as an AND contract without loading an unconfigured registry
- **AND** Omission SHALL select the canonical .focused-spec/evidence.yaml through the same loader. Explicit sources SHALL NOT trigger fallback, nested includes, or implicit repository-wide search. Each source SHALL match at least one YAML file; unsafe configuration, missing sources, unsupported matched extensions, overlapping lexical/canonical claims, and symlink escapes SHALL fail before evidence execution. Files SHALL be loaded deterministically.

<!-- focused-spec:id=registry.sharding.config-safe -->
#### Scenario: Unsafe registry configuration is rejected
- **WHEN** evidence configuration is empty, contains unknown fields, or declares unsafe source patterns
- **THEN** configuration fails before source discovery

<!-- focused-spec:id=registry.sharding.source-boundaries -->
#### Scenario: Source boundaries are enforced
- **WHEN** configured sources are missing, overlap lexically or canonically, match non-YAML files, or resolve outside the project
- **THEN** registry loading reports the offending source rather than silently dropping or accepting it

### Requirement: Scope-local uniqueness and diagnostic provenance
Each selected (scope, ID) SHALL occur at most once across all configured files, with no merge or last-wins resolution.

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

Registry source patterns SHALL use the same limits as document patterns: 4096 characters, 32 nested group levels with parentheses limited to 2 levels, 256 brace delimiter characters and 256 expanded alternatives per pattern. Excess SHALL produce an actionable violation without partially loading sources. Bounded alternatives SHALL preserve padded and stepped numeric ranges.

<!-- focused-spec:id=registry.glob.bounds -->
#### Scenario: Excessive registry pattern complexity
- **WHEN** an evidence source exceeds a documented pattern bound
- **THEN** registry loading reports the invalid source without returning a partial registry

### Requirement: Unreadable registry source discovery

A matched dangling symlink SHALL be reported as an unreadable source, not silently removed from the registry selection.

<!-- focused-spec:id=registry.source.broken -->
#### Scenario: Dangling registry source link
- **WHEN** a registry source pattern matches a dangling symlink beside a readable shard
- **THEN** loading reports the unreadable source instead of silently accepting incomplete evidence
