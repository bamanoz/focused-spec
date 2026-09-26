## 1. Scenario enrollment

- [x] 1.1 Update parser/model to separate unenrolled native `#### Scenario:` blocks from enrolled blocks, recognizing malformed ID, EVIDENCE, and REVISES labels as enrollment; keep native WHEN/THEN from triggering enrollment.
- [x] 1.2 Add core behavioral checks for mixed blocks, evidence without ID, malformed enrollment markers, and unchanged strict cardinality/evidence validation for enrolled scenarios.

## 2. Selection and reporting

- [x] 2.1 Update discovery/validation to allow legacy-only documents and scopes beside enrolled scopes; reject an explicitly selected empty-enrollment scope and an all-scope selection containing documents but no enrolled outcomes.
- [x] 2.2 Expose the unenrolled scenario count separately in full validation and run text/JSON; ensure no native scenario appears as PASS and scenario-filtered output still identifies its narrower selection.
- [x] 2.3 Add CLI behavior checks for mixed documents/scopes, all-legacy selection, empty-document selection, and partial-coverage reporting using real selected evidence.

## 3. Agent lifecycle and documentation

- [x] 3.1 Update `skills/focused-spec/SKILL.md` to guide per-outcome enrollment and before/after ID/evidence/owner comparison across any framework document transition, including a final-discovery run and honest native-coverage reporting.
- [x] 3.2 Update `docs/concepts/README.md`, `docs/guides/configuration.md`, `docs/reference/cli.md`, and `docs/development/agent-evals.md` as their owning topics require; preserve framework-neutral rules and check documentation links/tree.
- [x] 3.3 Strengthen `openspec-brownfield` eval gates to require that legacy scenarios survive, the final selected document owns a valid ID and executes real evidence after the working document disappears, and lost/redirected evidence fails the gate; run the isolated eval.

## 4. Evidence and verification

- [x] 4.1 Implement the exact Vitest selectors declared by these delta scenarios, replace their `planned:` prefixes, and run strict validation and execution for this change scope.
- [x] 4.2 Run `npm test`, the affected real CLI path, and `openspec validate support-incremental-spec-adoption --strict`; then follow the repository workflow to sync validated specs and verify evidence after the working change leaves discovery.
