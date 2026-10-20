# Design

## Context

See proposal.md. Both plugin hosts serialize before parent validation; `isJsonValue` currently accepts non-plain objects and sparse arrays. Human event rendering already escapes control/format/separator characters, but other output paths do not.

## Goals / Non-Goals

Goals: reject lossy plugin responses, preserve opaque identities and values, and reuse the existing escaping policy for human output.

Non-goals: sandboxing trusted plugins, changing plugin versions, reserving runner names, rewriting selectors or modifying JSON output schemas.

## Decisions

- Strengthen existing JSON validation for plain data objects, dense arrays, finite primitives and acyclic structures. Reject accessors/custom objects rather than invoking serializers; shared acyclic values remain legal. Both hosts validate original responses before sending, and parents keep shape/cardinality checks.
- Recognize `planned:` only when it is not the start of `planned::`; a deferred reference to that runner is `planned:planned::selector`.
- Extract the existing safe-text function into a shared terminal-text module for CLI, inspection and command errors. Preserve diagnostic newlines by splitting before escaping each line; layout remains host-owned. Instructions and plugin-document content remain intentional documents, not reformatted prose.
- Add regressions to test/audit-runtime.spec.ts using isolated consumers and actual CLI calls. Bind runner.response.lossless, format.response.lossless, validation.planned.runner-id and execution.presentation.safe-text in their existing capability registries to the correspondingly named tests under `audit runtime correctness`.

## Risks / Trade-offs

Explicit undefined optional properties now fail instead of being silently omitted; callers must omit absent fields, matching exactOptionalPropertyTypes. JSON checking adds one traversal before transport. No sanitization occurs in executable selectors or machine results. Source-mode and compiled execution must remain supported.

## Evidence and sensitivity

Exact tests: `vitest::test/audit-runtime.spec.ts::audit runtime correctness > rejects lossy runner responses before transport`, `... > rejects lossy format responses before transport`, `... > executes the planned runner without deferring concrete evidence`, and `... > escapes opaque human output without changing execution or JSON`.

Run those regressions before and after implementation. In a disposable compiled core copy, separately remove each host guard, restore the old planned-prefix test and bypass shared escaping; each matching selected assertion must fail, then pass after restoration. Run npm test and real CLI paths before native sync/archive and final all-scope execution.
