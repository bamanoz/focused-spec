# Proposal

## Why

A scenario status alone does not show which inputs were exercised, what was actually observed, or why the application chose a branch. A common SDK event contract must survive runner transport and core aggregation so standalone demos, humans and agents can inspect the same execution instead of reconstructing it from console output.

## What Changes

- Add an optional execution-local `onEvent` channel to the independent TypeScript and Go SDKs. The SDK emits named observations for Given, When, Expect and the actual returned observation; application explanations use the same channel with optional structured data.
- Add optional `events` to runner target results and evidence results while retaining Runner API 1 and existing status, diagnostic, selection and deduplication semantics. Core validates a small JSON event union, not language-specific Given/When/Expect semantics.
- Add `focused-spec run --details`; JSON always retains available events. Compact text shows events for nonpassing evidence; detailed text shows them for all evidence. Add native scenario `name` and `source` to run results.
- Carry events through both direct scenario runners, including mismatch/application-error reports. Keep bounded event retention with an explicit truncation marker and no fabricated observations after a crash.
- Demonstrate the full experience in both maintained bank consumers: real account branch explanations, unchanged six scenarios, standalone event-driven demos, detailed focused output, JSON, and separate consumer-codec roundtrip checks.

## Capabilities

### New Capabilities

- `execution-events`: Optional SDK event capture, immutable observations, structured explanations, portable language observations and both bank demonstrations.

### Modified Capabilities

- `runner-protocol`: Optional validated target-event reports, legacy plugin compatibility, bounded retention and failure transport.
- `scenario-execution`: Evidence-local event attribution, native result metadata and compact/detailed/JSON presentation without changing execution policy.

## Impact

- Core public runner/result types, IPC validation, planner, executor and CLI; independent SDKs; both direct scenario runners and their worker/bridge reports; existing consumer and integration tests; owning API/CLI/SDK/runner/example documentation.
- No format grammar or configuration changes, new packages, runtime dependencies, logging levels, tracing hierarchy, file attachments or stdout scraping. Core does not depend on either SDK.
- The earlier [SDK-only proposal](../add-scenario-explanations-and-codec-checks/proposal.md) remains untouched as the canonical source of its seven explanation/codec outcomes. This new change expands the intent to a product-wide report rather than editing that proposal silently. Implement the two together with one final event API: do not first ship its unimplemented `onExplain` design. Preserve all seven native IDs, both-language evidence and codec work; the old no-core/no-runner implementation boundary is replaced by the newly requested scope, not a cancellation of its behaviors.
- Implementation planning includes both bank codec checks and their evidence explicitly. `run` name/source enrichment is now included; separate workflow strengthening and TypeScript cancellation-cleanup alignment remain outstanding and are not declared complete.
