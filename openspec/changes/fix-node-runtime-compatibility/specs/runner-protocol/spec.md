# runner-protocol delta

## ADDED Requirements

### Requirement: Supported-runtime source execution
The official Vitest runner SHALL resolve and execute exact selected evidence when loaded from its TypeScript source on every supported Node.js version, including 22.16.0, without caller-provided type-stripping flags. Compiled package execution SHALL retain the same selected outcomes.

<!-- focused-spec:id=runner.official.source-runtime -->
#### Scenario: Source runner launches its helper on the minimum Node runtime
- **WHEN** the source-mode Vitest runner selects passing and failing tests on Node.js 22.16.0 without ambient type-stripping flags
- **THEN** it resolves the exact tests and reports their actual independent outcomes instead of failing to load its helper
