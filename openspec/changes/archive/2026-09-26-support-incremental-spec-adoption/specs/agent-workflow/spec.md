## ADDED Requirements

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL enroll new or changed outcomes without bulk-converting unrelated native scenarios. Before and after a framework-owned document edit, publication, replacement, or removal, the agent SHALL compare affected enrolled IDs, outcome meaning, evidence references, and cross-scope ownership in the documents that will remain selected. It SHALL retain executable evidence for every still-relevant enrolled outcome and SHALL NOT leave a surviving `REVISES` chain depending solely on a source that leaves discovery. After the final document selection is established it SHALL strictly validate and execute surviving evidence; it SHALL distinguish passing enrolled outcomes from unverified native history. No particular SDD lifecycle command SHALL be required.

#### Scenario: Untouched native outcomes remain untouched
- **ID**: `agent.adoption.preserve-native`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > preserves legacy outcomes while enrolling one changed outcome`
- **WHEN** an agent adopts focused-spec in a project with native historical scenarios and one changed outcome
- **THEN** the changed outcome gains executable evidence while unrelated native scenarios remain present and unreported as passed

#### Scenario: Surviving evidence outlives a working document
- **ID**: `agent.adoption.surviving-owner`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects an orphan revision after a working document leaves discovery`
- **WHEN** a changed outcome is retained in a selected final document but its earlier working document stops being selected
- **THEN** the retained occurrence owns its ID or revises a still-selected same-ID source and its evidence executes without the working document

#### Scenario: Final evidence continues to mean the same outcome
- **ID**: `agent.adoption.evidence-continuity`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > detects lost or altered evidence across document transitions`
- **WHEN** a document transition would drop or redirect the evidence of an enrolled changed outcome
- **THEN** the workflow rejects completion instead of accepting a transient PASS or claiming historical coverage
