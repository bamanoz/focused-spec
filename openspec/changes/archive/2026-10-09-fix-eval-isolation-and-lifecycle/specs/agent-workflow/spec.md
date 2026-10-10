## ADDED Requirements

### Requirement: Isolated evaluation provisioning

Provisioning SHALL install independently owned package artifacts without rebuilding or modifying the shared repository distribution. Concurrent workspaces SHALL NOT delete or replace each other's package artifacts. Cleanup SHALL remove the workspace and its owned package artifacts.

#### Scenario: Concurrent provisioning preserves the built distribution
- **ID**: `agent.eval.provisioning-isolation`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > provisions parallel workspaces without rebuilding shared distribution`
- **WHEN** two eval workspaces are provisioned concurrently from a built product
- **THEN** both installed CLIs remain usable and the shared distribution is unchanged

### Requirement: Phase-correct lifecycle evaluation

Lifecycle evaluation SHALL independently execute working evidence before a host transition can remove its discovery, and SHALL independently execute the surviving occurrence after that transition. Final validation and controlled mutations SHALL use the surviving configured scope. Missing or failing pre-transition evidence SHALL stop the lifecycle before its next turn. Final evidence SHALL match the independently executed checkpoint and SHALL NOT be inferred from agent claims.

#### Scenario: Working evidence is verified before its discovery ends
- **ID**: `agent.eval.lifecycle-checkpoint`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > judges working evidence before sync removes its discovery`
- **WHEN** apply produces passing working evidence and sync retains the same main evidence while excluding the working document
- **THEN** working and surviving main evidence pass independently after working discovery ends, and altered evidence fails completion

#### Scenario: Failed working evidence prevents publication judgment
- **ID**: `agent.eval.lifecycle-stop`
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > stops before sync when working evidence fails`
- **WHEN** apply completes but its selected working evidence fails
- **THEN** the working checkpoint fails and the sync turn is not run
