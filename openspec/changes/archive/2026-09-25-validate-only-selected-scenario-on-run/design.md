## Context

`run` currently calls `validateFocusedSpecs` over the selected scopes and `planEvidence` over all returned documents; only `projectExecutionPlan` applies `--scenario`. Unrelated planned, malformed, or unresolved evidence inside the same scope therefore stops the requested test. Scope discovery and ID ownership remain separate from evidence resolution.

## Goals / Non-Goals

**Goals:** Apply the same scenario filter to strict document validation, evidence resolution, and execution for `run --scenario`. Preserve shape/evidence checks and repository-wide revision ownership for the selected ID, including multiple scopes revising the same ID. Make the actual validation selection visible in CLI text and JSON.

**Non-Goals:** Change `validate` (which has no `--scenario` option), relax strict checks for the selected scenario, change the no-`--scenario` behavior, add flags, or change runner IPC.

## Decisions

1. Add an optional selected scenario ID to the `validateFocusedSpecs` options, passed only by `run`. After discovery, retain only matching scenarios from the selected scopes when validating document shape and resolving evidence. Retain document scope/path identity, and do not report unrelated malformed scenario headings as selected-scenario errors. A selected ID missing from the scope selection fails before any runner invocation. Alternative: filter only in `planEvidence`; this leaves planned and structural errors from unrelated scenarios blocking execution.
2. Keep discovery's path/overlap protections and inspect original discovered scenario metadata for ownership. Restrict ownership violations to the selected ID, but follow `REVISES` links across unselected scopes to check that the selected scenario has a real same-ID owner and no cycle or competing unmarked owner. Do not validate or resolve unrelated source-scope evidence. Alternative: omit cross-scope ownership checks for a fast selected run; this could pass an orphan revision.
3. Pass already filtered documents through `planEvidence` and `projectExecutionPlan` so selected evidence resolves once, then executes once per unique target. When `--scope` is omitted, the same ID in multiple scopes selects every matching occurrence, and all its evidence must pass. Without `--scenario`, retain existing full-scope checks and execution unchanged.
4. Add optional `scenario` to `validationScope` for `run --scenario`, matching the existing `executionSelection.scenario`. Text similarly states `validation scope: ..., scenario <id>`. Do not claim complete scope validation in a scenario-only run. A missing scenario is a validation failure with `executionStarted: false`.

## Risks / Trade-offs

- Invalid unrelated evidence no longer blocks a selected scenario. Full `run` or `run --scope <name>` still provides a scope-wide execution gate; `validate --strict` remains resolution-only.
- Malformed headings without a valid ID cannot be associated with a selected scenario; full validation continues to detect them. Selection never bypasses errors inside its matched scenario or ownership links.
- All-scope `run --scenario` must retain scoped result identity if revisions repeat the ID; reuse the existing scope field rather than conflating them.

## Migration Plan

Update the scenario-level regression evidence, implementation, CLI help, normative CLI guide, and bundled skill. Prove the new path with a previously blocking unrelated evidence fixture and a selected malformed/orphan scenario; run tests plus a real selected evidence invocation. Sync validated deltas into main specs and archive the change after implementation.

## Open Questions

None.
