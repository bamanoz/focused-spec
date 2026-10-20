# Proposal

## Why

Core currently accepts and renders a closed union of SDK observations and explanations. This violates the agreed producer-neutral event boundary and rejects legitimate events from independent runners.

## What Changes

- **BREAKING**: replace the core event union with `kind: string`, `message: string`, optional JSON `data`; remove the core `ObservationEvent` export.
- Validate and display all event kinds through the same envelope without interpreting producer semantics, including a producer's `truncated` kind.
- Preserve bounded prefix retention and an explicit overflow notice without treating a producer kind as control flow.
- Translate SDK-specific events in the TypeScript and Go runners, leaving independent SDK contracts intact.
- Migrate affected assertions, reference documentation and exact evidence together.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runner-protocol`: producer-neutral event envelope, malformed-report validation and bounded retention.
- `scenario-execution`: uniform human rendering of arbitrary event kinds.

## Impact

Core public runner API, event validation/collection, CLI rendering, both direct scenario runners, existing integration/CLI/bank tests, `docs/reference/runner-api.md`, `docs/reference/cli.md`, runner guidance pages and capability-owned evidence. No new dependency or SDK-to-core coupling.
