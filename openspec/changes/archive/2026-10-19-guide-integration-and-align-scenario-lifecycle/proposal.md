# Proposal

## Why

Agents can compose focused-spec with native requirements, inline Markdown, existing tests or independent executable SDKs, but currently must choose plugins before their installed documentation can explain them. The earlier workflow-strengthening and TypeScript cancellation/cleanup obligations also remain open: choosing a composition must lead to genuine behavioral evidence and resource release that cancellation does not itself prohibit.

## What Changes

- Add offline CLI-owned `instructions --protocol 1 --topic integration [--json]`, available from core alone before project configuration or plugin installation. Preserve the default `workflow` topic and protocol-1 response envelope.
- Put composition selection in that on-demand topic: inspect the existing host, canonical behavioral source, evidence ownership, test/runtime stack and authorization; retain supported existing choices; select only necessary packages. Include a compact, nonexclusive capability map for native Markdown/Gherkin plus registry, standalone inline Markdown, existing test runners, and independent TypeScript/Go SDKs with optional CLI plugins. Host names do not determine formats.
- Break the bootstrap cycle with package-owned orientation before installation, then acquire each selected installed package's exact public contract with `plugin-docs`. Do not copy package dialects into core guidance, fetch packages during instruction retrieval, or turn the map into an allowlist.
- Route first integration and explicitly requested composition changes from the universal workflow to `integration`. Keep installation-only work separate from configuration and evidence authoring; installation documentation bootstraps core and the loader rather than owning a competing selection procedure.
- Strengthen the universal workflow for all representations: preserve one native source, identify the real application boundary and independently authored expected outcome, prevent drivers from duplicating the product rule or echoing expectations, and distinguish real execution/comparison from explanations, codec checks and validation. Retain phase/approval, exact evidence, AND, sensitivity and host-lifecycle obligations.
- Align TypeScript cleanup with Go's cancellation-independent release: after successful preparation await cleanup exactly once with cancellation removed, preserving scenario identity and explanations. Keep action cancellation checks, partial-preparation ownership, primary/cleanup error aggregation and honest forced-termination limits. **Behavioral change:** cleanup no longer receives the caller's abort signal.
- Prove delivery through packed offline consumers, lifecycle regression checks and black-box agent outcomes rather than guidance wording assertions; update the existing documentation owners during apply.

## Capabilities

### New Capabilities

None. Reuse the existing guidance/workflow boundaries and the executable SDK capability introduced by the completed SDK change.

### Modified Capabilities

- `agent-guidance`: add the integration topic, its offline/fail-closed delivery and separation from plugin-specific documentation.
- `agent-workflow`: add phase-aware integration selection and strengthen application-grounded single-source authoring across text and executable representations.
- `executable-scenarios`: extend cleanup and cancellation behavior for the TypeScript SDK. This capability's baseline is the completed, unarchived [SDK delta](../add-executable-scenario-sdk/specs/executable-scenarios/spec.md), not yet `openspec/specs/executable-scenarios/spec.md`; this change reuses that exact capability rather than creating a duplicate.

## Impact

- Core CLI guidance dispatch/help and packaged assets; new authored `guidance/integration.md`, existing `guidance/workflow.md`, and on-demand format/runner handoffs where necessary. The installed loader remains thin and workflow-first.
- TypeScript SDK `verifySpecification` lifecycle; no new SDK dependency, config version, format/runner API or execution-event schema.
- Existing CLI/package/SDK tests and black-box eval provisioning/judgment for the new selection and executable-authoring cases; existing human installation, configuration, CLI, SDK and eval documentation/indexes.
- Preserves unrelated workspace work, existing plugin contracts and completed event/codec outcomes. No implementation, executable evidence setup, release, sync or archive is authorized by this proposal turn.
