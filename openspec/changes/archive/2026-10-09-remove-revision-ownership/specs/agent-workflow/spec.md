## MODIFIED Requirements

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL enroll new or changed outcomes without bulk-converting unrelated native scenarios. Before and after framework-owned edits, publication, replacement, or removal, it SHALL compare affected IDs, native-item bindings, outcome meaning, and evidence in surviving selected scopes. It SHALL retain explicit executable evidence for every still-relevant enrolled occurrence without owner or revision links and SHALL NOT inherit evidence from a disappearing scope. After the final selection is established it SHALL execute surviving evidence and distinguish passing enrolled outcomes from unverified native history. No particular SDD lifecycle command SHALL be required.

#### Scenario: Untouched native outcomes remain untouched
- **ID**: `agent.adoption.preserve-native`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > retains executable evidence after a working document leaves discovery`
- **WHEN** an agent enrolls one changed outcome in a project with native historical scenarios
- **THEN** unrelated native scenarios remain present and unreported as passed

#### Scenario: Surviving evidence outlives a working document
- **ID**: `agent.adoption.surviving-evidence`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > retains executable evidence after a working document leaves discovery`
- **WHEN** an outcome remains in a final selected scope and its working document leaves discovery
- **THEN** the surviving occurrence independently retains its ID and explicit evidence and executes without the working document

#### Scenario: Final evidence continues to mean the same outcome
- **ID**: `agent.adoption.evidence-continuity`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > detects lost or altered evidence across document transitions`
- **WHEN** a transition drops or redirects evidence for an enrolled changed outcome
- **THEN** the workflow rejects completion instead of accepting transient passing evidence

## ADDED Requirements

### Requirement: Scoped evaluation judgment
Evaluation gates SHALL inspect the expected scenario within its configured selected scope and SHALL honor document discovery and exclusions. Same-ID occurrences in other scopes SHALL NOT be counted as duplicate selected items. Missing or duplicate expected occurrences within the selected scope SHALL fail the scenario contract.

#### Scenario: Same identity in a different scope is not a duplicate
- **ID**: `agent.eval.scoped-identity`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > judges the selected scope when another scope has the same ID`
- **WHEN** valid same-ID occurrences exist in the selected scope and another configured scope
- **THEN** the scenario gate judges the selected occurrence and its evidence without counting the other occurrence as a competing owner
