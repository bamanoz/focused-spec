## Why

`run --scenario <id>` currently validates and resolves every scenario in its scope selection before running the requested scenario. During incremental development, unfinished or broken evidence in an unrelated scenario prevents the requested scenario's real test from running.

## What Changes

- **BREAKING:** With `--scenario`, `run` strictly validates and resolves only matching scenarios within the selected scope(s), then executes exactly those scenarios. Without `--scenario`, existing all-scopes or selected-scope strict behavior remains unchanged.
- Preserve repository ID ownership and `REVISES` checks for selected scenarios, including links to source scopes, without requiring unrelated evidence to resolve.
- Reject a missing selected scenario before execution; report the actual scenario-level validation selection in text and JSON. `validate` remains unchanged and never executes tests.
- Update help, guides, skill, and focused scenarios with executable evidence for the changed behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `validation`: Narrow strict scenario/evidence validation during `run --scenario` without weakening selected-scenario ownership and shape checks.
- `scenario-execution`: Resolve and run the selected scenario instances only, distinguishing repeated IDs by scope, while preserving full-scope behavior without `--scenario`.
- `cli-help`: Explain that `--scenario` narrows both validation and execution for `run`.

## Impact

`src/validate.ts`, `src/cli.ts`, possibly `src/planner.ts`; `test/cli.spec.ts`; `docs/reference/cli.md`, `docs/guides/configuration.md`, `docs/concepts/README.md`, `skills/focused-spec/SKILL.md`, and active capability specs. CLI `validationScope` JSON gains an optional `scenario` field for scenario-selected runs. No runner protocol or new CLI flag.
