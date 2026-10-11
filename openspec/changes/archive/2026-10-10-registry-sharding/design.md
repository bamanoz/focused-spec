## Context

The current version-3 loader reads one fixed YAML registry. Discovery and transitions depend on that loader; transition snapshots intentionally retain logical registrations rather than physical YAML placement. This repository already has capability boundaries and active independent scopes.

## Goals / Non-Goals

**Goals:** implement explicit YAML source composition, preserve all identity/evidence/selection/transition invariants, migrate every API consumer, and migrate every repository registration into domain shards.

**Non-Goals:** databases, nested includes, automatic repository-wide source search, scope ancestry or evidence inheritance, version changes, or changing unrelated native host workflows.

## Decisions

- Optional `evidence: { files: [...] }` in configuration v3. A nonempty list names safe project-relative paths/patterns. Omission selects the canonical `.focused-spec/evidence.yaml` using the same implementation; one-file projects need no alternate parser. Explicit configuration never falls back to that file.
- Each source must match at least one `.yaml`/`.yml` file. Deterministic sorted discovery checks realpath containment and rejects overlapping lexical or canonical file claims. Prefer errors over deduplication that hides configuration mistakes. Structural source and YAML errors remain global; entry semantics and cross-shard duplicate checks honor scope/ID selection like the existing parser.
- Public `loadEvidenceRegistry(root, files?, scope?, id?)` replaces the former selection argument positions. `EvidenceEntry.registryPath` carries diagnostics only; it is not identity, external native source metadata, or snapshot semantics.
- Existing logical registration normalization stays placement-independent. All transition reads use configured sources. Actual-entry violations use live file/line provenance; absent-entry and whole-registry violations point to configuration rather than an invented monolith. Configuration fingerprints include explicit registry sources.
- Reuse capability ownership for `.focused-spec/evidence/<capability>.yaml`, permitting multiple scopes in each shard. Configure the repository's shard paths explicitly. Compare the complete pre/post logical registry before deleting the obsolete monolith.
- Update portable CLI-owned guidance to inspect configured files, reuse existing domain ownership, and create a shard only for a genuine new boundary; preserve approval and planning/apply rules.

## Risks / Trade-offs

- Glob patterns can unintentionally overlap → reject repeated canonical claims and unmatched patterns.
- Malformed unrelated entries must not block a scoped selection → filter before entry validation and duplicate comparison; syntax/source safety errors cannot be isolated reliably.
- Transition comparison could mistake relocation for mutation → keep provenance out of immutable logical snapshots, while validating every configured shard before/after execution.
- Existing evals might assume the monolith → load their configuration and call the same public loader; keep legitimate default-file fixtures.

## Migration Plan

Implement and verify loading first, then preserve every existing `(scope, ID)` and entry while partitioning by owning native capability. Replace repository configuration and remove the monolith only after equality proof. Keep both previously active changes active and package version 0.6.0.

## Executable Evidence

Exact new selectors use `vitest::test/registry-sharding.spec.ts::sharded evidence registry > <test name>` for:

- `composes explicit domain shards with AND evidence`
- `rejects duplicate identities across shards with both locations`
- `isolates selected identities and scopes across shards`
- `reports binding failures at their shard and line`
- `rejects unsafe evidence configuration before discovery`
- `rejects missing overlapping unsupported and escaping sources`

Transition evidence uses `vitest::test/transitions.spec.ts::checked evidence transitions > publishes across shards without making placement identity` and `vitest::test/transitions.spec.ts::checked evidence transitions > rejects sharded configuration and untouched registration drift`.

Execute exact selected evidence, full `npm test`, real CLI consuming-project publication prepare/verify/final, and repository `run`. Introduce reversible product regressions for each new outcome, require assertion failure rather than runner error, restore, and rerun. Retained modified requirement scenarios reuse their existing exact evidence from the owning domain shards.

## Observed Verification

- Pre-cutover equality: all 131 existing registrations preserved across 10 capability shards; an eleventh shard owns the 8 new sharding outcomes. No previous scope or evidence was removed.
- `npm test`: 13 files, 155 tests passed; build and strict test/example/eval typechecks passed.
- `node dist/cli.js run --scope registry-sharding`: 20 PASS, 19 unique targets, no FAIL/SKIP/ERROR.
- Full repository `node dist/cli.js run` before publication: 151 PASS, 140 unique targets, no FAIL/SKIP/ERROR; strict validation passed.
- Real consuming-project CLI: explicit alternate configuration, 2 shards, prepare, host publication/untouched relocation, verify, intentional AND failure, repair, final cleanup, immutable snapshot, full run, and cross-file duplicate blocking before execution all observed.
- Isolated sensitivity: all 8 new outcomes passed, failed on selected assertions under product regressions, then passed after restoration. Transition drift additionally detected both configuration drift and loss of untouched behavior. A first provisioning attempt lacked eval dependencies and was rejected before execution; the corrected disposable workspace completed all probes.
- `npm run smoke`: real Go and pytest example both passed.
- Documentation check: 17 pages, valid relative links/anchors, every documentation page reachable from its indexes.
- Repository publication preparation and surviving verification: 20 PASS and 19 unique targets against `.focused-spec/transitions/registry-sharding.json`; the approved native delta was synced before ordinary verification.
- Only `registry-sharding` was archived as `2026-10-10-registry-sharding`; `cli-owned-agent-guidance` and `checked-evidence-transitions` remain active and unchanged. All 9 main capabilities passed strict OpenSpec validation.
- Owned smoke/sensitivity scripts and disposable workspaces were removed. The exact publication plan and immutable snapshot remain under `.focused-spec/transitions/` for independent handoff verification.
- Repository `transition verify .focused-spec/transitions/registry-sharding.json --final`: successful, 20 PASS / 19 unique targets. Final full repository `run`: 139 PASS / 140 unique targets, no FAIL/SKIP/ERROR; this is the original 131 registrations plus 8 published sharding outcomes after the temporary working scope retired.
- Snapshot SHA-256 remained `68b392aba4e5764f44a7ac5d51a69ebabe74ff08034ef31e7ff044b0cdcd5f4c` across sync, surviving verification, archive, retirement, and final verification. Final documentation links/index reachability also passed.
