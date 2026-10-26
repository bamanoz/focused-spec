# Spec Delta

## ADDED Requirements

### Requirement: Session-aware guidance evaluation
Evaluation SHALL require valid workflow acquisition per execution context and permit its reuse across clarification or approval in the same resumed session while the serving installation, version and guidance remain unchanged.

<!-- focused-spec:id=agent.eval.guidance-approval-reuse -->
#### Scenario: Approval resumes an already activated dialogue
- **WHEN** a native authoring or publication dialogue resumes the same persisted session after clarification or approval, with valid prior workflow acquisition and unchanged serving installation and guidance
- **THEN** its workflow-acquisition gate passes without requiring a duplicate read, while all authorization, host, integrity, evidence, and sensitivity checks retain their independent verdicts
- **AND** Evaluation reuse SHALL NOT alter distributed guidance or grant additional permissions.

<!-- focused-spec:id=agent.eval.guidance-invalidation -->
#### Scenario: A changed installation requires current guidance
- **WHEN** the serving installation, package version, or authoritative workflow content changes before a resumed execution is judged
- **THEN** retained acquisition alone does not pass; a completed valid acquisition from the current installation is required, and an earlier correctly acquired response is not retroactively rejected merely because it belongs to the previous installation state

<!-- focused-spec:id=agent.eval.guidance-initial-boundary -->
#### Scenario: Late reading cannot repair missing initial activation
- **WHEN** the first executed turn of a dialogue lacks a completed valid workflow acquisition and a later continuation obtains it
- **THEN** the initial acquisition failure remains a task-success gate failure, including when the later response or final evidence is valid

<!-- focused-spec:id=agent.eval.guidance-context-boundary -->
#### Scenario: A fresh execution context cannot borrow acquisition
- **WHEN** publication, regeneration, or another workflow starts a fresh session rather than resuming its prior acquisition context
- **THEN** it requires its own valid workflow acquisition and cannot pass solely from guidance observed in the prior context

<!-- focused-spec:id=agent.eval.guidance-repeat-observation -->
#### Scenario: Missing redundant reads remain observations
- **WHEN** a correctly completed native dialogue retains valid unchanged guidance but does not repeat acquisition after approval
- **THEN** the saved result retains the missing repeat as a non-gating observation without changing task or lifecycle success, certification, exit status, or triggering a failure interview; a real outcome failure still fails independently, and historical artifacts remain unchanged
