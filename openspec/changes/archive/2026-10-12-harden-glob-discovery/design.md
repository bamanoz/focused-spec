# Design

## Context

See proposal.md for motivation. Node 22.16.0 is supported. Runtime glob consumers are src/sources.ts and src/registry.ts; four evaluation modules and a provisioning fixture also depend on fast-glob. Existing realpath checks enforce lexical/canonical source identity and project boundaries.

## Goals / Non-Goals

**Goals:** remove the vulnerable production chain, retain ordinary pattern semantics and reject pathological patterns before matching; finish commit, push and publication.

**Non-Goals:** change the loader protocol, runner API, registry schema or unrelated dependencies.

## Decisions

Use glob 13.0.6 and an explicit minimatch dependency for bounded brace expansion. A small internal src/glob.ts boundary checks length, group depth and brace delimiter count before expansion. Expand with a sentinel limit of 257 alternatives, reject more than 256, then match with nobrace so neither positive nor exclusion patterns can be expanded again or truncated silently. The 4096-character and 257-result ceilings stay below brace-expansion's aggregate output-character cap. Limit brace delimiter count to 256 to stay below its rewrite ceiling. Preserve dot, nodir, follow, nocase:false, absolute output and lexical source paths. Keep existing canonical path checks. Trusted eval patterns use glob directly; translate embedded negative patterns to explicit ignore.

glob does not expose minimatch's extglob-recursion setting. Reject parentheses deeper than 2 levels explicitly so its matcher cannot silently fall back to literal matching for unsupported nested extglobs. Count braces even inside character classes because brace expansion runs before character-class matching.

Exact evidence:
- config.glob.bounds: vitest::test/cli.spec.ts::focused-spec CLI > rejects excessive document and exclusion glob complexity
- config.glob.compatible: vitest::test/cli.spec.ts::focused-spec CLI > preserves padded stepped and hidden document discovery
- registry.glob.bounds: vitest::test/registry-sharding.spec.ts::sharded evidence registry > rejects excessive registry glob complexity without partial sources
- registry.source.broken: vitest::test/registry-sharding.spec.ts::sharded evidence registry > reports dangling registry links beside readable shards

Run these in the change scope, prove assertion sensitivity with reversible product regressions, then restore PASS. Run npm test, real Go/pytest smoke, the actual CLI on Node 22.16.0 and current Node, production consumer audit and packed/published package checks before completion.

## Risks / Trade-offs

Patterns exceeding the new limits are intentionally rejected. glob has different defaults and does not interpret fast-glob's negative array entries: callers must set equivalent options and move exclusions to ignore. Audit checks must cover the published consumer, not only a repository containing an older self devDependency. The self devDependency can be refreshed after the fixed version is available; it must not require an unpublished version to build the release.
