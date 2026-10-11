## ADDED Requirements

### Requirement: CLI-owned workflow and separate loader
The npm package SHALL contain the authoritative focused-spec workflow and runner guidance required by `instructions`, together with an independently installable focused-spec loader skill. The loader SHALL preserve installer-readable discovery metadata but SHALL NOT embed a second maintained copy of the workflow or runner guidance. Consumer guidance access SHALL NOT require this repository's documentation or source. CLI installation SHALL remain separate from skill activation and SHALL NOT rewrite installed agent instructions or local customizations.
The package SHALL ship only the new loader and CLI-owned guidance format, without legacy full-text skill copies, obsolete format readers, aliases, conversion tooling, or compatibility shims. Consumer-project migration SHALL remain separately requested agent work rather than an installation side effect.

<!-- focused-spec:id=distribution.package.agent-guidance -->
#### Scenario: Packed guidance works independently of the source checkout
- **WHEN** a consumer installs the packed package in a disposable project without access to the source checkout
- **THEN** its installed CLI supplies both guidance topics and its skill remains separately discoverable without creating agent files in the consumer project
