# Spec Delta

## ADDED Requirements

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
