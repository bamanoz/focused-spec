# Proposal

## Why

The eight package-owned guidance topics repeat plugin-document acquisition, application-observation rules, permission boundaries, and verification policy. Maintaining several full versions creates drift risk; the current evidence establishes duplication, not a need for new workflow adapters or a change to verification policy.

## What Changes

- Consolidate existing common procedure into existing owning topics: `workflow` for universal permissions, installation/root provenance and plugin-document acquisition; `author-revise` for authoring, identity/evidence reconciliation and complete approval handoff; `verify` for application-observation checks, sensitivity procedure and executed lifecycle verification.
- Replace full copies in the other topics with short operation-specific reminders and explicit same-installation topic handoffs. Retain necessary local prohibitions and review/author/upgrade checklists; shared rules must remain available when needed, not become implicit.
- Keep SDK-only execution independent and host approvals/lifecycle authoritative. Preserve every current evidence, AND-member, restoration, final-scope and deferred-obligation requirement.
- Retain all eight topics, guidance protocol 1, offline package delivery and current response-size bounds. No loader, CLI runtime, build-time fragment system, new directory, or host adapter is needed.
- During apply, update the block-3 improvement entry to describe this selected editorial consolidation, leaving block 2's verification-policy decision deferred. Review the README and documentation map without duplicating portable procedure there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a behavior-preserving editorial refactor of installed guidance, not a new product requirement. The change explicitly uses `skip_specs: true`; existing `agent-guidance`, `agent-workflow`, and plugin-documentation contracts remain unchanged. Design records the preserved outcomes and intended exact evidence rather than introducing artificial delta scenarios.

## Impact

- Primary files: the eight existing `guidance/*.md` topics. No product source, public API, package dependency, plugin dialect, registry or configuration change is planned.
- Documentation: `docs/development/candidate-improvements.md` block 3 and existing guidance-ownership pointers if needed. Root `README.md` must remain accurate and must not advertise the proposal as shipped behavior.
- Verification: reuse existing CLI/packed-consumer tests and targeted black-box cases; measure before/after guidance bytes and route acquisitions without claiming token/time improvements from text reduction alone.
- This proposal authorizes planning only. It neither implements consolidation nor revises the mutation policy discussed in block 2. Other recorded improvement blocks remain outstanding, not cancelled.
