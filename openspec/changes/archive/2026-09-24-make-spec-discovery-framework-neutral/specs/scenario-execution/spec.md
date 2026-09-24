## MODIFIED Requirements

### Requirement: Execution selection
After strict validation, `run` SHALL execute baseline scenarios by default or the selected named scope with `--scope`; `--scenario` SHALL narrow only the executed scenarios. A selected scope with no configured matching documents SHALL cause an error before execution. Text and JSON results SHALL distinguish the baseline-plus-selected/all-scopes validation set from the baseline or named-scope execution selection without using OpenSpec-specific labels.

#### Scenario: Default execution selects baseline scenarios
- **ID**: `execution.selection.current`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > separates run validation scope from current execution selection`
- **WHEN** run is called without a scope name while other named scopes exist
- **THEN** it executes baseline scenarios and reports validation scope separately from execution selection

#### Scenario: Named scope and scenario selection
- **ID**: `execution.selection.change-scenario`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > reports selected change and scenario execution independently of validation scope`
- **WHEN** run selects one scenario inside a named scope
- **THEN** it executes that scenario and reports the selected scope and scenario in its result

#### Scenario: Missing named scope does not start execution
- **ID**: `execution.selection.missing-scope`
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > refuses to execute a named scope without documents`
- **WHEN** run explicitly selects a scope with no documents in the configured layout
- **THEN** it reports a missing-scope violation and `executionStarted: false` without claiming PASS

### Requirement: Evidence results and success policy
Each resolved target SHALL run once per unique runner/target pair and contribute its actual `PASS`, `FAIL`, `SKIP` or `ERROR` status to every scenario that cites it. A scenario SHALL pass only if all its evidence passes; skips are non-success unless the explicit `--allow-skip` policy applies.

#### Scenario: Shared target is executed only once
- **ID**: `execution.targets.shared`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > runs one shared target once for two scenarios`
- **WHEN** two scenarios refer to the same resolved runner target
- **THEN** the target executes once and both scenarios receive its result

#### Scenario: Skipped evidence is not relabelled PASS
- **ID**: `execution.status.skip-policy`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > does not claim skipped evidence as passing`
- **WHEN** a runner skips the only evidence and allow-skip is off or on
- **THEN** the scenario remains SKIP in both cases while only explicit allow-skip permits overall success

#### Scenario: Failing evidence makes the scenario fail
- **ID**: `execution.status.fail`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > propagates a failing target to the scenario and process result`
- **WHEN** a selected target fails its real test
- **THEN** the scenario is FAIL and run returns nonzero rather than claiming PASS

#### Scenario: Runner error cannot pass a scenario
- **ID**: `execution.status.error`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/integration.spec.ts::project-local TypeScript runners > reports runner execution errors without a false pass`
- **WHEN** runner execution throws or returns an invalid response
- **THEN** the affected scenario is ERROR and run is unsuccessful

#### Scenario: Empty execution is distinguishable from proof
- **ID**: `execution.status.empty`
- **REVISES**: baseline
- **EVIDENCE**: `vitest::test/cli.spec.ts::focused-spec CLI > preserves successful validation when no specifications match`
- **WHEN** no baseline scenarios match the configured source and no named scope was requested
- **THEN** run reports `executionStarted: false` and zero scenarios rather than claiming any PASS
