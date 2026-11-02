# Proposal

## Why

The installed loader requires separate version, workflow, and operation-topic requests, while operation guidance already relies on the workflow router; this adds avoidable latency and repeats substantial text before work can begin. Its trigger also treats meaning-preserving copy edits like behavioral work, creating unnecessary activation without weakening the approved activation for standalone BDD scenarios, drivers, and SDD outcomes.

## What Changes

- Return the common workflow router together with a requested operation topic in one `instructions` response, keeping the requested topic, protocol, package identity, and installed version explicit and validated.
- Let the loader learn package identity/version from that response instead of requiring a separate version command; retain strict validation of protocol and response identity, and keep version lookup available for its existing independent use.
- Make operation guidance usable with the included router while retaining router-only acquisition for routing-only steps and direct requests for shared topics as needed.
- Reduce the mandatory skill trigger only for semantically inert copy edits, such as spelling, punctuation, or formatting that leaves requirements, scenarios, behavior, and evidence unchanged. Preserve the approved broad trigger for BDD executable scenarios and application drivers, including SDK-only work, and for behavioral SDD/BDD requirements regardless of host or explicit invocation.
- Add isolated live evaluation cases for combined guidance acquisition and skill-trigger boundaries; run both with the same explicit model before any model matrix.
- Preserve all host approval, read-only/planning, package provenance, offline behavior, plugin documentation, validation, and version/protocol compatibility boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-guidance`: Combined router and requested operation-topic responses and explicit response identity/version validation while retaining protocol-1 semantics.
- `agent-workflow`: Keep broad BDD/SDK-driver and behavioral SDD activation while excluding only demonstrably meaning-preserving editorial-only changes from mandatory skill activation.

## Impact

The affected surfaces are `packages/core/src/instructions.ts` and its CLI contract, `skills/focused-spec/SKILL.md`, `guidance/*.md`, agent guidance/workflow specifications, the black-box evaluation cases and owning evaluation documentation. No dependency, configuration, plugin, SDK, OpenSpec, or Spec Kit integration changes are proposed. Existing loaders will need their normal package-owned refresh to consume the revised acquisition flow; this proposal does not publish a release or update consumer installations.
