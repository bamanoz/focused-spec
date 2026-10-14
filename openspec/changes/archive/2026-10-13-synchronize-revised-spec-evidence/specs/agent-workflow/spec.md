# Spec Delta

## ADDED Requirements

### Requirement: Specification review reconciles enrolled evidence
An authorized enrolled specification revision SHALL reconcile its identity, binding and every evidence assertion with the revised outcome in existing registry ownership. Still-relevant outcomes and AND obligations SHALL survive. Retained green evidence SHALL NOT certify revised behavior without exact execution and changed-outcome sensitivity; completion SHALL validate the final selection.

<!-- focused-spec:id=agent.review.evidence-sync -->
#### Scenario: Revised behavior cannot retain stale green evidence
- **WHEN** an already-enrolled blocked-login outcome is revised to explicitly reject valid credentials but its registered tests still cover only invalid credentials
- **THEN** evaluation rejects unchanged green evidence and accepts the preserved identity only after both exact valid-credential tests are registered in the owning shard, execute and fail under the matching product regression, while unrelated registrations survive

### Requirement: Evidence reconciliation respects review phases
Read-only review SHALL report evidence gaps without writes. Planning-only work SHALL record deferred exact evidence changes without writing executable integration or claiming synchronization complete.

<!-- focused-spec:id=agent.review.phase-boundaries -->
#### Scenario: Review and planning do not authorize integration writes
- **WHEN** a read-only review or planning-only revision identifies necessary evidence changes
- **THEN** the workflow reports or plans those changes without writing registry, configuration, tests or product implementation, and does not claim the revised integration complete
