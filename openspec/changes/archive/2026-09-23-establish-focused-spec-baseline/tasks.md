## 1. Project-local evidence runner

- [x] 1.1 Add `.focused-spec/config.yaml` for `source: openspec` and register the project-local `vitest` runner; keep the shipped example's configuration independent.
- [x] 1.2 Implement exact `<repo-relative test file>::<full Vitest test name>` resolution from `vitest list --json`, rejecting absent or ambiguous targets with stable IDs and actionable errors.
- [x] 1.3 Execute only the selected Vitest target with argument arrays, `shell: false`, supplied cwd and abort signal; map real exit status to pass/fail/skip and bound diagnostics.
- [x] 1.4 Prove the runner selects exactly one listed test and that a controlled failing test cannot yield PASS.

## 2. Scenario and configuration boundaries

- [x] 2.1 Add the focused core targets for missing/multiple ID-WHEN-THEN rows and a scenario with no EVIDENCE row; assert actionable validation errors.
- [x] 2.2 Add CLI targets for unreadable, malformed and unsupported configuration; assert a nonzero result for each independently failing case.
- [x] 2.3 Add CLI targets for an escaping runner path and non-JSON-compatible runner options; assert rejection before a module runs.

## 3. Validation and runner protocol boundaries

- [x] 3.1 Add a syntax-only CLI target proving an unavailable runner is never loaded; add a current-ID/ADDED collision target without breaking legitimate MODIFIED reuse.
- [x] 3.2 Add isolated runner targets for timeout and wrong selector cardinality (missing, duplicate and unrequested), with explicit error outcomes.
- [x] 3.3 Add isolated runner targets for escaping source locations and invalid target results (missing, duplicate and unknown IDs); prove no false PASS.

## 4. Execution, distribution and agent gates

- [x] 4.1 Add a two-scenario target that counts a shared target's actual executions once and attributes its result to both scenarios.
- [x] 4.2 Add real failing and runner-error targets that assert FAIL/ERROR aggregation and unsuccessful CLI exit rather than a passing result.
- [x] 4.3 Add isolated consumer tests that pack/install the CLI, execute it, typecheck `focused-spec/runner` imports and verify installation creates neither skill nor runner.
- [x] 4.4 Add deterministic eval-judge tests for proposal implementation leakage, controlled mutation insensitivity and protected-file changes; retain the existing failed-turn gate.
- [x] 4.5 Replace every `planned:` reference with its exact implemented Vitest selector; confirm all concrete selectors appear once in `vitest list --json`.

## 5. Strict handoff and baseline sync

- [x] 5.1 Run `npm test` and `npm run smoke`, reporting observed results, optional dependencies and any skips.
- [x] 5.2 Run strict OpenSpec validation and `focused-spec validate --change establish-focused-spec-baseline --strict`, then execute `focused-spec run --change establish-focused-spec-baseline` against the real runner.
- [x] 5.3 Mutate a behavior guarded by baseline evidence and confirm focused execution fails; restore the original source and reconfirm PASS.
- [x] 5.4 Sync the seven capabilities into `openspec/specs/`, keep the documentation map and owning pages consistent, then archive the completed change only after every task and gate passes.
