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

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL enroll new or changed outcomes without bulk-converting unrelated native scenarios. Before and after a framework-owned document edit, publication, replacement, or removal, the agent SHALL compare affected enrolled IDs, outcome meaning, evidence references, and cross-scope ownership in the documents that will remain selected. It SHALL retain executable evidence for every still-relevant enrolled outcome and SHALL NOT leave a surviving `REVISES` chain depending solely on a source that leaves discovery. After the final document selection is established it SHALL strictly validate and execute surviving evidence; it SHALL distinguish passing enrolled outcomes from unverified native history. No particular SDD lifecycle command SHALL be required.

#### Scenario: Untouched native outcomes remain untouched
- **ID**: `agent.adoption.preserve-native`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > preserves legacy outcomes while enrolling one changed outcome`
- **WHEN** an agent adopts focused-spec in a project with native historical scenarios and one changed outcome
- **THEN** the changed outcome gains executable evidence while unrelated native scenarios remain present and unreported as passed

#### Scenario: Surviving evidence outlives a working document
- **ID**: `agent.adoption.surviving-owner`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects an orphan revision after a working document leaves discovery`
- **WHEN** a changed outcome is retained in a selected final document but its earlier working document stops being selected
- **THEN** the retained occurrence owns its ID or revises a still-selected same-ID source and its evidence executes without the working document

#### Scenario: Final evidence continues to mean the same outcome
- **ID**: `agent.adoption.evidence-continuity`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > detects lost or altered evidence across document transitions`
- **WHEN** a document transition would drop or redirect the evidence of an enrolled changed outcome
- **THEN** the workflow rejects completion instead of accepting a transient PASS or claiming historical coverage
