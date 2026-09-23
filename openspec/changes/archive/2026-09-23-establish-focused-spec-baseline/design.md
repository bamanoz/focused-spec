## Context

`focused-spec` 0.1.1 already has working CLI parsing, validation, runner IPC, execution, package exports, a separate skill and black-box agent evals. Existing contracts live in `docs/` and tests; `openspec/specs/` is empty. The root `.focused-spec/` was intentionally removed because it had no runner. This change introduces the baseline contract, not new runtime behavior. The proposal phase must not install runners, alter tests or pretend planned targets passed.

## Goals / Non-Goals

**Goals:** Give each shipped product boundary one named OpenSpec capability; make every scenario repository-unique, independently falsifiable and linked to an exact executable target or an explicit planned target; leave a strict-validation/execution path for the apply phase.

**Non-Goals:** Reimplement the CLI, mirror every internal function, assert a coverage percentage, pin cosmetic wording, install an agent-specific skill, treat an agent model's success as a universal guarantee, or execute missing targets during planning.

## Decisions

1. **Seven capability owners, one requirement per independent contract.** Scenario format, project configuration, validation, runner protocol, execution, distribution and agent workflow have separate owners. Alternative: a monolithic spec with many unrelated scenarios; rejected because future deltas would have competing owners and weak failure attribution. These are `ADDED Requirements` only because no baseline specs currently exist.
2. **One deterministic `vitest` evidence environment for the repository.** Selector shape is `<repo-relative test file>::<full Vitest test name>`; e.g. `vitest::test/core.spec.ts::focused specification parsing > parses a focused scenario and opaque runner selector`. `vitest list --json` is available and reports exact `{file,name}` records. In apply, `.focused-spec/config.yaml` will select `source: openspec`, register `.focused-spec/runners/vitest.ts` and the runner will resolve by exact file/name match, returning one target or one actionable error. `run` will execute the selected Vitest test in an abort-aware, shell-free child and interpret its exit status. Alternative: reuse the example Go/pytest plugins or a mock passing runner; rejected because those are another project's evidence or do not prove this package.
3. **Existing tests use concrete references; absent tests use `planned:`.** Preserve real test titles as selectors; introduce a new focused test only where an independently failing contract lacks protection. The planned runner ID and selector format remain fixed now; apply must implement every planned target and remove every `planned:` before the change is complete. Model-dependent agent eval cases are supplementary review gates, not default `run` targets.
4. **Planning-only proposal with on-demand apply configuration.** No root `.focused-spec/` is created in this turn. A temporary external configuration may be used to validate structure without changing product files; full/strict validation and execution become meaningful only after the real runner is implemented. Alternative: commit a nonfunctional runner/config merely to obtain a green planning check; rejected as false evidence and a violation of the proposal/apply boundary.
5. **Behavioral baseline, not a second manual.** Specs own concise observable SHALL outcomes. Detailed commands, config fields and API types remain in their existing `docs/` owners; link between them on sync/archive rather than duplicating reference prose.

## Risks / Trade-offs

- Existing tests sometimes bundle multiple assertions; linking one test to multiple independent outcomes would overstate evidence. Mitigation: keep scenarios scoped to the behavior actually asserted and plan a new target for every other boundary.
- Focused validation requires a config even for `--syntax-only`; a planning-only change cannot pass it against the repository root today. Mitigation: validate the OpenSpec delta with OpenSpec, and if needed run the syntax-only focused check with an ephemeral configuration outside the repository. Never report that full execution passed in this turn.
- A runner that maps every selector to `pass` would make the master spec vacuous. Mitigation: require exact Vitest discovery, isolated test execution, negative result handling and a controlled mutation that fails focused execution during apply.
- Live agent evals depend on model credentials and outside components. Mitigation: keep them explicit non-default acceptance checks; report individual gates and limitations rather than converting them to unguarded `PASS`.

## Migration Plan

In apply: implement/register the real Vitest runner, add only missing behavior tests, replace planned evidence, run `npm test`, `npm run smoke`, `openspec validate establish-focused-spec-baseline --strict`, `focused-spec validate --change establish-focused-spec-baseline --strict`, and `focused-spec run --change establish-focused-spec-baseline`. Verify a controlled mutation fails. Then sync/archive all seven baseline capabilities to `openspec/specs/` and keep existing detailed docs and their map consistent. Rollback removes the new runner/config and baseline specs without changing shipped package behavior.

## Open Questions

None for the proposal. Apply must verify exact Vitest selector uniqueness and may adjust planned *target names* only if an existing collision is demonstrated, retaining scenario IDs and one-owner semantics.
