# Design

## Context

See proposal.md for motivation. Six independent npm packages expose config v4 and format/runner API v1; evals use those packages as black-box products. The completed static inventory is `.eval-cache/code-audit-static-reviews.json`. Candidates require executable reproduction, not presumed fixes.

## Goals / Non-Goals

**Goals:** Restore exact identity, bounded process lifetime, input/protocol validation and trustworthy evaluation at existing consumer seams. Keep implementation explicit, package-local and measured.

**Non-Goals:** No API migration, compatibility aliases, release/version change, historical-result rewrite, prompt hints or cosmetic module splitting. These boundaries do not remove any requested audit area.

## Decisions

- Reproduce before source fixes: add behavioral regressions to existing test owners, run selected RED centrally, then change source and run GREEN. A rejected candidate requires an executable positive/negative observation rather than an unexplained omission.
- Scope capture normalizes harmless leading relative segments. Native binding tracks the normalized item object rather than diagnostic coordinates. JSON validation tracks the active recursion stack, accepting repeated acyclic aliases.
- Runner settlement is bounded independently of pipe closure, but scheduler release still waits for confirmed host exit. Validate IPC objects and discriminator-specific fields before consuming them. Reuse init's duplicate-option convention and help precedence.
- Vitest selection uses its public collected task specifications/IDs, not flattened names or private internals. Keep consumer-owned framework resolution and command options. Streaming decoders remain local to independently distributable runner packages.
- Markdown inline markers only trail permitted paragraph/list items; standalone adjacency uses actual neighboring node positions. Preserve current legitimate bindings.
- Staging replaces only its owned generated directories. Reproduce stale compiler output independently before adopting a build cleanup. Never clear authored inputs.
- Eval gates require selected behavioral FAIL and restored exact PASS. Direct execution requires exact source/selector plus observed execution. Consent matches complete path boundaries. Integrity snapshots are judged at proposal checkpoint, before apply can undo violations. Freeze the actual configured scope, not the change name.
- Deepen shared eval seams only for process termination/result persistence and transcript interpretation when callers need the same behavior. Persist driver failures with bounded output, exclusive result creation and last-attempted request/session diagnostics. Keep scoring and blind task prompts unchanged.
- Planner indexing is local and preserves provenance, AND evidence and target deduplication. Benchmark before/after; omit unmeasured performance claims.

## Ownership and exact evidence

- Bindings: `config.ts`, `sources.ts`, `planner.ts`; `test/cli.spec.ts`, `plugins.spec.ts`, `runner.spec.ts`. Runtime writer instead owns a new `test/audit-runtime.spec.ts` to avoid shared CLI edits.
- Runtime: `runner-client.ts`, `cli.ts`, `instructions.ts`; exact tests in `test/audit-runtime.spec.ts` for inherited pipes, malformed envelopes and duplicate options.
- Adapters: official runner source and Markdown adapter; `test/core.spec.ts`, `official-runners.spec.ts`. Exact cases exercise flattened Vitest collisions, delimiter titles, invalid inline placement, detached list markers and split UTF-8.
- Eval: `evals/**` and its existing test owners (`evals.spec.ts`, `native-pilot.spec.ts`, `acp-agent.spec.ts`). Exact cases defend all nine retained findings; no product-package edits.
- Main: build/staging, `test/package.spec.ts`, existing docs, all OpenSpec/registry integration, final commands and archive. Intended selectors are the actual full names of the above regression cases, recorded after the tests exist; existing copied scenarios retain every prior exact registry reference.

## Risks / Trade-offs

- Public Vitest APIs vary by version → use supported installed public declarations and real consumer execution, not private fields.
- Descendants retaining pipes/processes → exercise real inherited pipes and process groups with explicit cleanup; retain failure transcript.
- False-positive static findings → require RED at real seams, keep rejected evidence in audit proof.
- Stronger eval judgments can expose genuine model failures → report new immutable results without weakening gates or rewriting history.
- Concurrent edits → nonoverlapping file ownership; one central build/typecheck/test pass, no mid-flight validation.

## Migration Plan

No consumer migration. Validate this change, implement reproductions and repairs, update existing owning docs, bind exact scope-local evidence, run narrow and full checks, sync the six deltas and archive only after surviving evidence passes. No commit/push/publication is authorized.
