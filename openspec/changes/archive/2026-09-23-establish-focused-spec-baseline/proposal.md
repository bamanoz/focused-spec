## Why

The project ships a CLI, runner API, agent skill and eval harness, but `openspec/specs/` has no authoritative description of their current observable behavior. Record the shipped 0.1.1 contract as one reviewable baseline so future changes can amend named capabilities instead of rediscovering behavior from implementation and tests.

## What Changes

- Add focused, evidence-linked OpenSpec requirements for the existing scenario language, configuration and source discovery, validation scopes, runner boundary, execution results, package installation and agent workflow.
- Reuse exact existing tests as evidence where they prove an outcome; mark missing targets `planned:` and make the apply phase supply real tests and a project-local Vitest runner before strict validation and execution.
- Keep this proposal planning-only. No CLI, plugin, test, package or installation behavior changes in the proposal turn; applying the baseline should not introduce a second normative owner for existing detailed documentation.

## Capabilities

### New Capabilities

- `scenario-authoring`: Focused scenario identity, shape and evidence reference semantics.
- `project-configuration`: Versioned YAML runner configuration and file/OpenSpec source discovery.
- `validation`: Syntax/full validation, current/change scopes, planned evidence and pre-execution failures.
- `runner-protocol`: Project-local plugin resolution, isolated invocation and result integrity.
- `scenario-execution`: Selected evidence execution, shared targets, statuses and skip policy.
- `distribution`: Installed CLI, public runner types and separately installed agent skill.
- `agent-workflow`: Proposal/apply separation and black-box evaluation of real project-local evidence.

### Modified Capabilities

None; `openspec/specs/` has no existing capability specs. `ADDED Requirements` establish the baseline, not new product functionality.

## Impact

Planning artifacts and delta specs under `openspec/changes/establish-focused-spec-baseline/` only in this turn. During apply, add `.focused-spec/config.yaml` and a project-local runner for deterministic Vitest targets, fill genuine test gaps, replace planned references, strictly validate and execute the change, then sync/archive its specs to `openspec/specs/`. Existing `docs/` pages remain the detailed owner of CLI/configuration/API instructions; the new capability specs own concise behavioral invariants.
