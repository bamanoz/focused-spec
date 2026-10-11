# Spec Delta

## ADDED Requirements

### Requirement: Self-guided authorized project upgrades
An explicitly requested focused-spec update SHALL include the project-local package, its installed agent integration, fresh authoritative guidance, and any required project-format migration. It SHALL preserve still-relevant native behavior, scope-local identities, exact evidence references, AND contracts, and runner/execution configuration, without automatic conversion or legacy runtime support.

<!-- focused-spec:id=agent.upgrade.preserve-project -->
#### Scenario: A bare update request completes a legacy project upgrade
- **WHEN** an agent receives only a request to update focused-spec in a runnable version-2 project with a legacy full-text skill
- **THEN** it upgrades the local package and installed loader, acquires fresh package-owned instructions, migrates each still-relevant occurrence to an explicit native binding and registry entry, and successfully validates and executes all migrated evidence
- **AND** repeated IDs retain independent scope-local evidence rather than inherited REVISES relationships; unrelated product, tests, runners, and integrations remain unchanged

### Requirement: Independently bounded upgrade evaluation
A blind upgrade evaluation SHALL start with a genuine published legacy package and skill and obtain the candidate through ordinary package-manager installation. Legitimate package/integration replacement SHALL be judged against an independently owned candidate artifact rather than exempted from integrity checks. Ordinary non-upgrade evaluations SHALL retain their existing protections.

<!-- focused-spec:id=agent.upgrade.reject-loss -->
#### Scenario: A green project cannot conceal migration loss or package tampering
- **WHEN** a migrated workspace loses or redirects an original scope-local evidence occurrence or modifies the candidate package after installation
- **THEN** independent upgrade gates reject completion even if its remaining focused evidence passes
