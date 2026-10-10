## Context

The current parser records REVISES rows and the validator builds a repository-wide owner graph. The portable workflow also requires publishing a durable owner before working scopes disappear. The approved model instead treats scopes as independent evidence contexts; host frameworks retain responsibility for native revisions and publication.

## Goals / Non-Goals

**Goals:** Remove revision metadata and public fields; require uniqueness only within `(scope, ID)`; preserve explicit per-occurrence evidence, selected-scope isolation, all-scope result identity, and evidence after document movement; make eval gates scope-aware.

**Non-Goals:** Implement the experimental native-ID CLI, infer semantic equivalence or revision ancestry, inherit evidence, add reserved scopes, modify OpenSpec workflows, release a version, or alter saved results and archived changes.

## Decisions

1. Delete revision parsing, enrollment labels, Scenario fields, chain traversal, and cross-scope ownership checks. Only ID and EVIDENCE labels enroll a CLI block. Other native prose remains outside the focused contract; there is no compatibility alias for removed metadata.
2. Keep the validator's existing `(scope, ID)` duplicate map. Each selected occurrence must supply its own evidence. Scoped runs neither resolve nor validate another scope's same-ID occurrence; all-scope runs include every occurrence and preserve scope in results. Existing executable-target deduplication remains unchanged.
3. Evaluate scenario contracts within the configured selected scope, using real document discovery rather than a repository-wide Markdown search with a fabricated scope. Brownfield checks still require surviving main evidence, preserved native outcomes, and evidence continuity after hiding the working document; they no longer require an owner or revision edge.
4. Remove old graph-only tests and migrate remaining selection tests away from REVISES fixtures. Preserve history under openspec/changes/archive and evals/results. Do not add a replacement revision field to the native registry.

## Risks / Trade-offs

- Cross-scope accidental ID reuse is no longer rejected. Reusing an ID is the author's identity assertion; native workflow review owns semantic continuity.
- Scope-local duplicates must continue failing, including same-ID occurrences in different documents of one scope.
- A passing occurrence must not supply missing evidence to another occurrence. Cover this with an explicit missing-evidence boundary test.
- Eval discovery must honor configured scopes and exclusions, not accept archived or unrelated Markdown as the selected item.

## Verification

Run exact Vitest evidence in the delta specs, npm test, the real OpenSpec example, a disposable two-scope CLI probe with distinct evidence and same-scope duplicate rejection, and the real packaged openspec-propose-apply evaluation that previously miscounted scoped occurrences. Validate Markdown links, sync specs through OpenSpec, validate main specs, archive the completed change, and run repository focused evidence after archive.
