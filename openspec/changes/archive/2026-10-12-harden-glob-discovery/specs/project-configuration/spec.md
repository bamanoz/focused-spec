# Spec Delta

## ADDED Requirements

### Requirement: Bounded glob discovery

Document and exclusion patterns SHALL be limited to 4096 characters, 32 nested group levels with parentheses limited to 2 levels, 256 brace delimiter characters and 256 expanded alternatives per pattern. Excess SHALL fail with an actionable violation before matching or runner loading, never by truncating files. Bounded matching SHALL preserve case-sensitive paths, hidden files, exclusions, symlink lexical paths, and padded and stepped numeric ranges.

<!-- focused-spec:id=config.glob.bounds -->
#### Scenario: Excessive document or exclusion pattern complexity
- **WHEN** a document or exclusion pattern exceeds a documented complexity bound
- **THEN** validation rejects the configured source with a complexity diagnostic before loading runners

<!-- focused-spec:id=config.glob.compatible -->
#### Scenario: Bounded numeric and hidden-file discovery
- **WHEN** bounded patterns combine padded and stepped ranges with hidden files and explicit exclusions
- **THEN** validation discovers exactly the selected native items and preserves their scopes
