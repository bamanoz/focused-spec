## MODIFIED Requirements

### Requirement: Evidence rows
Evidence SHALL live only in the required logical evidence registry composed from configured YAML files, keyed by scope and stable ID. The registry SHALL contain only a scopes mapping; entries SHALL contain a nonempty evidence list and optional external source mapping containing exactly path and nativeId. Unknown or duplicate fields and behavioral text fields SHALL fail validation. References SHALL use [planned:]<runner-id>::<opaque selector>; every reference SHALL be checked and multiple references form an AND contract.

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
