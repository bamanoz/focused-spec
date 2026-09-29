## ADDED Requirements

### Requirement: New and changed evidence detects the claimed outcome
For each new or changed evidence reference, the agent workflow SHALL run the exact selected evidence, introduce a reversible regression in the claimed product behavior (not in the test, selector, runner, or assertion), require the selected test to execute and fail on its behavioral assertion, restore the behavior, and confirm the same evidence passes again. An unresolved target, runner error, skip, or unrelated test failure SHALL NOT count as a sensitivity check. When the regression cannot be introduced safely, the agent SHALL disclose the unverified sensitivity rather than claim it passed. This requirement does not cause the CLI to mutate product code automatically.

#### Scenario: Falsely green evidence is rejected
- **ID**: `agent.evidence.vacuous-repair`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects vacuous evidence even after product repair and requires an agent sensitivity probe`
- **WHEN** an existing selected test checks only the type of an authentication result and remains green after blocked-account protection is removed
- **THEN** the agent evaluation rejects that evidence until the selected test fails on the blocked-account assertion and passes again after restoration; it also rejects an agent turn that omits the sensitivity probe

## MODIFIED Requirements

### Requirement: Black-box agent evaluation
Agent evaluations SHALL install the packed CLI into disposable workspaces, protect unrelated product tests and installed package files, and report each gate independently. An unsuccessful agent turn SHALL prevent downstream success claims. A successful turn SHALL have loaded the focused-spec skill before its behavior is judged; a coincidental passing result without skill activation SHALL NOT certify the skill workflow.

#### Scenario: Failed agent turn stops downstream judges
- **ID**: `agent.eval.failed-turn`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > records a failed agent turn without running downstream judges`
- **WHEN** an evaluated agent turn exits unsuccessfully
- **THEN** the eval result records the failed turn and does not claim downstream behavior gates passed

#### Scenario: Protected files cannot be altered for a pass
- **ID**: `agent.eval.protected-files`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > rejects protected test and package changes in an evaluated workspace`
- **WHEN** an agent changes a protected product test or installed package artifact
- **THEN** the integrity gate fails independently of other passing checks

#### Scenario: Successful turn must read the focused-spec skill
- **ID**: `agent.eval.skill-activation`
- **REVISES**: current
- **EVIDENCE**: `vitest::test/evals.spec.ts::agent eval harness > stops an OpenSpec turn before judging artifacts if the agent skipped the skill`
- **WHEN** a successful evaluated agent turn reads its host workflow skill but never reads the focused-spec skill
- **THEN** the skill-activation gate fails before judging downstream artifacts
