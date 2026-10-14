# Design

## Context

The loader serves package-owned workflow guidance. Existing authoring and lifecycle rules already require explicit evidence but lack a single review/revision reconciliation step. CLI validation checks structural bindings, not whether assertions imply revised prose. Eval fixtures and exact product mutation already support protected polyglot authentication tests.

## Goals / Non-Goals

**Goals:** Make semantic reconciliation explicit on review/revision, preserve every still-relevant AND member and independent registration, and prove the stale-green failure with real installed-package execution. Keep read-only and planning-only workflows non-writing.

**Non-Goals:** Automatic NLP equivalence checking, registry schema changes, mandatory rewriting of already-correct references, API/configuration changes, and publishing another release.

## Decisions

- Add a compact ordered procedure immediately after phase boundaries in `guidance/workflow.md`. Inventory each touched enrolled item, compare its changed outcome with actual selected assertions, update only necessary tests/references in owning shards, reconcile approved splits/moves/removals, then validate and execute the completed scope and prove sensitivity. Review-only reports gaps; planning-only records concrete deferred work and does not write registry/config/product files.
- Add `reviews` to loader discovery frontmatter; retain the loader-only body and serve all procedure through the installed CLI.
- Add blind `spec-evidence-revision` eval. Existing ID `auth.login.blocked-account` starts bound to two protected tests that reject blocked accounts with invalid credentials. Separate protected tests already cover valid credentials. Product is already correct. User asks only to review/sharpen the existing spec, explicitly without modifying product/tests. Completing only prose or keeping old green references must fail independent selection and mutation gates; selecting both existing valid-credential tests must pass. An independent second-scope active-account registration remains unchanged in the same auth shard.
- Use existing `scenarioGate`, `mutationGate`, protected snapshots and result storage rather than a second runner/evaluation framework. Add one case-specific observable contract gate for revised native text, owning source retention and unrelated entries. Keep its product regression checks in the existing mutation machinery.
- Evidence: existing read-only proposal constraints plus deterministic real-CLI gate regressions for stale green selection, correct synchronization, unrelated-entry loss and missing revised outcome. Native requirement `agent.review.evidence-sync` binds the exact meaningful stale-green regression test; planning boundaries reuse existing evidence rather than source-text assertions.

## Risks / Trade-offs

Instruction compliance remains model-specific; fresh full public/native matrix is required and scores stay immutable. Strict CLI PASS still does not establish semantic equivalence. Model evaluators may legitimately keep an unchanged selector if they repair an editable assertion, but this case protects tests and deliberately requires selection of already-existing exact tests. Existing product and unrelated documents remain protected; fixture README integrity policy is not changed here.
