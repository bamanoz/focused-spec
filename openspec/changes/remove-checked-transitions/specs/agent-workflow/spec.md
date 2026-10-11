## MODIFIED Requirements

### Requirement: Evidence-preserving incremental adoption
The agent workflow SHALL bind new or changed native outcomes without bulk-converting unrelated native scenarios. The native host SHALL own publication, movement, regeneration, archive and removal. Still-relevant enrolled occurrences SHALL retain explicit scope-local native bindings and executable registry evidence without owner/revision links or evidence inherited from a disappearing scope. After the host operation and required cleanup, the workflow SHALL validate the final selection and execute surviving evidence, distinguishing passing registered outcomes from unverified native history. It SHALL NOT require transition commands, plans, snapshots or replacement checkpoint artifacts. State-only production validation SHALL NOT claim historical loss detection when both a native item and its registration disappear consistently. Independent lifecycle evaluators MAY still compare actual evidence they execute before and after a host operation.

<!-- focused-spec:id=agent.adoption.preserve-native -->
#### Scenario: Untouched native outcomes remain untouched
- **WHEN** an agent enrolls one changed outcome in a project with native historical scenarios
- **THEN** unrelated native scenarios remain present and unreported as passed

<!-- focused-spec:id=agent.adoption.surviving-evidence -->
#### Scenario: Surviving evidence outlives a working document
- **WHEN** an outcome remains in a final selected scope and its working document leaves discovery
- **THEN** the surviving occurrence independently retains its ID and explicit evidence and executes without the working document or a production transition checkpoint

<!-- focused-spec:id=agent.adoption.evidence-continuity -->
#### Scenario: Independent evaluation rejects lost outcome evidence
- **WHEN** an independently observed host lifecycle drops or redirects evidence for an enrolled changed outcome
- **THEN** the evaluator rejects completion instead of accepting transient passing evidence as proof of the surviving outcome
