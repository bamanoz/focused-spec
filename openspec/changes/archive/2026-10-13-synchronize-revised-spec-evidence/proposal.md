# Proposal

## Why

Real specification reviews have left existing evidence registries semantically stale: the registered old test still passes, but it no longer protects the revised native outcome. Existing workflow obligations are scattered and do not make reconciliation a distinct review/revision step.

## What Changes

- Make reviewing behavioral requirements an explicit focused-spec activation trigger without embedding the workflow in the loader.
- Add one package-owned review/revision reconciliation procedure covering identity, binding, owning shard and every AND reference; require checking assertions against the revised behavior, not merely retaining a green selector.
- Preserve review-only and planning-only write boundaries; record deferred integration explicitly instead of reporting synchronized completion.
- Add a blind public model evaluation of an already-enrolled outcome whose old exact Go/pytest evidence checks blocked accounts only with invalid credentials. The revised outcome must cover valid credentials using existing protected exact tests, retain the enrolled identity and independent registrations, and detect a real product regression.
- Keep CLI, configuration, plugin APIs and automatic validation semantics unchanged. No publication is part of this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-workflow`: completion of a specification revision includes semantic evidence reconciliation with phase-aware write boundaries; black-box evaluation rejects stale green evidence.

## Impact

Authored owners: `skills/focused-spec/SKILL.md`, `guidance/workflow.md`, existing eval case/judge/test tooling and `docs/development/agent-evals.md`. New fixture/prompt files live under the existing eval case ownership. Behavioral deltas and exact evidence bind through the existing agent-workflow capability and shard. Changed installed guidance requires fresh runs of every public case and every native host in revision/create modes, with immutable model scores and unavailable boundaries reported honestly.
