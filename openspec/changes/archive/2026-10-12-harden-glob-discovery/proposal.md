# Proposal

## Why

focused-spec 0.8.2 inherits GHSA-vfj7-8cjw-p6xm through fast-glob, micromatch and braces. Replacement matchers also require explicit complexity bounds: a green dependency audit alone does not prevent nested-pattern stack exhaustion or silently truncated discovery.

## What Changes

- Replace fast-glob with current glob 13.0.6 throughout runtime discovery and evaluations.
- Bound document, exclusion and evidence patterns before matching: 4096 characters, 32 nested group levels (parentheses at most 2), 256 brace delimiters and 256 brace expansions per pattern; reject excess explicitly rather than truncating.
- Preserve hidden files, fixed/captured scopes, padded and stepped numeric ranges, lexical paths, exclusions, deterministic loading and realpath safety checks.
- Add regression evidence for unsafe patterns, supported glob semantics and dangling source links.
- Commit, push and publish a verified patch release after syncing and archiving this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-configuration`: bounded document/exclusion matching and preserved discovery semantics.
- `evidence-registry-sharding`: bounded registry sources and fail-closed filesystem discovery.

## Impact

Runtime source discovery, evaluation tooling, package dependency metadata, behavioral tests and configuration documentation. Loader protocol 1, configuration version 3 and runner API 1 remain unchanged. Previously accepted patterns exceeding the documented security limits are now rejected.
