## 1. Behavioral evidence

- [x] 1.1 Replace the old scenario-filter blocker assertion with a regression where unrelated malformed/planned/unresolved evidence does not block the selected scenario; verify it fails before the fix.
- [x] 1.2 Cover selected-scenario invalid shape/evidence/revision, missing ID, and repeated ID across scopes with exact executable evidence.

## 2. Product behavior

- [x] 2.1 Narrow `run --scenario` structural validation, ownership checks, and resolution to matching scenarios while leaving `validate` and no-scenario `run` unchanged.
- [x] 2.2 Reflect scenario-level validation selection in text, JSON, and help; preserve single-resolution execution and missing-selection failures.

## 3. Documentation and verification

- [x] 3.1 Update the CLI contract, configuration guide, concepts, and bundled skill for scenario-selected strict validation.
- [x] 3.2 Replace every planned delta evidence with exact tests; verify the OpenSpec delta, focused-spec strict validation and execution, npm tests, smoke example, and documentation links.
