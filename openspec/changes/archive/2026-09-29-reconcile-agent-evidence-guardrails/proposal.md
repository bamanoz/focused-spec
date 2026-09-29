## Why

The previously shipped framework-neutral skill routing and evidence-sensitivity eval changed the agent workflow, but the main agent-workflow specification was not synchronized. This change records the implemented contract without claiming the specification preceded implementation.

## What Changes

- Record that a successful evaluated agent turn must actually load the focused-spec skill before downstream judgments.
- Record that new or changed evidence is checked against a reversible product regression, not merely a green test, and that the vacuous-evidence evaluation rejects a falsely green existing test.
- Synchronize these requirements and their exact executable evidence into the existing agent-workflow capability. No product or CLI change is proposed.

## Capabilities

### Modified Capabilities

- `agent-workflow`: Specify skill activation and evidence-sensitivity expectations already implemented in the bundled skill and agent evaluation harness.
