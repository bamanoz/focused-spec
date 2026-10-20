# Design

## Context

See proposal.md. Core currently dispatches validation, retention and presentation by SDK event kind. Independent SDKs own their typed observations; only their direct runners depend on core.

## Goals / Non-Goals

**Goals:** remove semantic coupling across public types, validation, collection and display in one cutover. Preserve status, attribution, strict preflight, snapshot isolation, byte/count limits and SDK-only execution.

**Non-Goals:** change standalone SDK event contracts, application comparisons, evidence selection or add plugin-specific renderers.

## Decisions

- Core `ExecutionEvent` is an interface with nonblank `kind`, nonblank `message`, optional `JsonValue` data. Extra fields are rejected. An open envelope avoids an ever-growing central union and keeps display deterministic.
- Display every event as `[kind] message` plus JSON data, using existing terminal escaping for all three fields. No SDK imports, label dispatch or kind-specific branches.
- Retention reserves the existing marker space and emits the existing generic `truncated` notice on local overflow. Supplied kinds, including `truncated`, never set collector state or invalidate following records. Only local overflow stops retention. Validate the full supplied suffix separately.
- TypeScript runner maps SDK observation name to message and wraps the SDK value/text representation in data; other SDK records map message/data directly. Go bridge owns the equivalent type switch and emits a local generic struct, not SDK interfaces. Text fallback stays explicit as `{text: ...}` versus `{value: ...}`.
- Remove core ObservationEvent without aliases. SDK ObservationEvent stays SDK-owned. Update only runner-facing assertions; standalone SDK assertions keep their current shape.

## Evidence and migration

Keep existing exact selectors under `vitest::test/integration.spec.ts::project-local TypeScript runners >` for `preserves event-capable and legacy runner results together`, `rejects malformed execution events without claiming pass` and `bounds valid target events with an explicit truncation marker`. Strengthen their assertions for arbitrary kinds, producer `truncated` followed by more records, generic malformed fields and invalid omitted suffixes. Keep `vitest::test/cli.spec.ts::focused-spec CLI > renders compact detailed and JSON events from the same execution contract` and assert arbitrary kind/data escaping. Bind those exact references independently in the active scope's existing registry owners and retain all current-scope obligations. Existing bank runner failure and real demo tests protect the producer translation.

Affected source: `packages/core/src/{runner-api,index,execution-events,cli}.ts`, `packages/runners/scenarios-typescript/src/worker.ts`, `packages/runners/scenarios-go/src/index.ts`. Update affected tests and owning reference/runner docs. Sync only through OpenSpec after strict active-scope execution, then archive and verify final enrollment.

## Risks / Trade-offs

- Breaking event payload shape → migrate both shipped producers and all runner-facing assertions together; document the new envelope.
- No terminal semantics for a producer's truncation kind → intentional; core bounds only its own retention, not producer policy.
- Generic output is less specialized → keep producer-selected labels in message and preserve explicit value/text data without loss.
