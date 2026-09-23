# agent-workflow Specification

## Purpose

Proposal/apply boundaries and black-box evaluation of executable evidence.

## Requirements

### Requirement: Proposal and apply boundaries
The agent workflow SHALL keep an OpenSpec proposal planning-only and SHALL require concrete executable evidence before treating an applied change as complete.

#### Scenario: Proposal does not start implementation
- **ID**: `agent.proposal.planning-only`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects a proposal that creates runner or product implementation`
- **WHEN** an agent proposal creates a runner or product implementation before the apply turn
- **THEN** the proposal checkpoint fails even if planning artifacts exist

#### Scenario: Apply requires independent executable evidence
- **ID**: `agent.apply.mutation-sensitive`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects applied evidence that misses a controlled product regression`
- **WHEN** a completed workspace's focused evidence remains green after a controlled product mutation
- **THEN** the completion judgment rejects the result rather than accepting a fake pass

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect product tests and installed package files, and report each gate independently. An unsuccessful agent turn SHALL prevent downstream success claims.

#### Scenario: Failed agent turn stops downstream judges
- **ID**: `agent.eval.failed-turn`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > records a failed agent turn without running downstream judges`
- **WHEN** an evaluated agent turn exits unsuccessfully
- **THEN** the eval result records the failed turn and does not claim downstream behavior gates passed

#### Scenario: Protected files cannot be altered for a pass
- **ID**: `agent.eval.protected-files`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects protected test and package changes in an evaluated workspace`
- **WHEN** an agent changes a protected product test or installed package artifact
- **THEN** the integrity gate fails independently of other passing checks
