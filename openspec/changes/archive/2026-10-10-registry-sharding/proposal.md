## Why

A single evidence file becomes a shared editing bottleneck as independent domains grow. The approved sharding work must also migrate this repository rather than leave support unused.

## What Changes

- Add optional version-3 `evidence.files` with explicit project-relative YAML paths or patterns; omission selects the canonical single-file default through the same loader.
- Compose one logical registry with strict selected `(scope, ID)` uniqueness, deterministic loading, safe paths, and file/line diagnostics. No nested includes or repository-wide implicit discovery.
- Keep scoped error isolation, independent identities across scopes, AND evidence, and checked-transition continuity independent of physical shard placement.
- **BREAKING**: the exported `loadEvidenceRegistry` accepts source patterns before optional selection arguments; migrate every consumer.
- Migrate this repository's complete registry into explicitly configured domain shards and update CLI-owned guidance and owning documentation.

## Capabilities

### New Capabilities
- `evidence-registry-sharding`: configured source composition, boundaries, diagnostics, selection, and checked-transition behavior.

### Modified Capabilities
- `project-configuration`: replace the fixed registry location contract with configured sources and the single-file default.
- `scenario-authoring`: evidence lives in one logical registry, possibly split across files, without changing its closed schema or identity semantics.

## Impact

Configuration, registry loading, native binding, transitions, public API consumers and eval gates; configuration and CLI documentation, portable workflow guidance, focused regression evidence, and repository registry placement. Package/config/runner versions and existing active changes remain unchanged.
