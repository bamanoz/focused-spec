---
name: focused-spec
description: "Use whenever an agent authors, revises, publishes, moves, or completes behavioral specifications in any specification-driven workflow. Load alongside the host workflow skill even if the user does not name focused-spec; plan exact executable evidence for changed outcomes and run it before completion."
---

# Focused Spec

Author small scenarios in the host framework's file, but use focused-spec's own IDs, evidence, and execution contract. The installed CLI and this bundled skill are sufficient; do not assume access to this skill's source repository.

Load this skill alongside the host workflow skill whenever the work creates, changes, publishes, or moves behavioral scenarios, even if the user never names focused-spec. Apply the host framework's authoring and lifecycle rules; its structural validation does not establish executable focused evidence.

Author a focused scenario for each independently failing new or changed outcome before treating the specification as ready; do not bulk-enroll unrelated historical outcomes. Do not wait for implementation or infer evidence from the host's acceptance prose. If the host's file cannot contain focused scenario blocks without violating its format or generation rules, put them in an adjacent Markdown companion and register that companion through the host's normal authoring workflow. Keep the host's requirement as the source of intent; the companion records the focused outcome and exact evidence, not a second copy of the entire specification. Never hand-edit a generated host artifact outside its owning workflow. Name the intended runner and selector using `planned:` when the target does not yet exist, and validate the planning scope non-strictly. Do not declare the implementation complete until all planned rows have been replaced and `focused-spec run` executes the selected tests successfully.

## Discover CLI commands and options

Before choosing a command or flag, consult the installed CLI: `focused-spec --help` lists commands; `focused-spec validate --help` and `focused-spec run --help` explain their options, defaults, selection rules, and examples. Help works even before `.focused-spec/config.yaml` exists. Use it instead of guessing flags; use this skill for scenario and runner workflow. Help is guidance, not evidence: still execute the selected tests as described below.

## Author a scenario

1. Find the one capability that owns the behavior and choose one independently failing outcome.
2. Assign a repository-unique lowercase dotted `ID`, exactly one `WHEN`, and exactly one `THEN`.
3. Choose the execution environment, runner ID, and opaque selector **before** adding `EVIDENCE`. Each row is required; multiple rows form an AND contract.

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `pytest-functional::tests/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Evidence is `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Any scope may use `planned:` while that exact test is not implemented, but strict validation and `run` reject it. To reuse an ID from another scope, add exactly one `- **REVISES**: <source-scope>` row naming an existing same-ID scenario; repeated IDs must form a graph with one unmarked owner and no missing sources, self-revisions, or cycles. Never infer revision from framework headings or a special scope name.

## Configure when first needed

When the first scenario names evidence, configure `.focused-spec/config.yaml` as soon as the host workflow permits project setup; do not create root-level `focused-spec.yaml`. Select Markdown that contains focused scenarios or is being adopted incrementally, and exclude archives explicitly. A real project-local runner can be implemented as soon as its selector contract is known, including during planning if the host workflow permits it; no fixed implementation phase is required. Follow the host workflow's proposal/implementation boundary. Register a functional runner for that evidence type, not a placeholder just to make validation pass; `planned:` selectors need not resolve until their tests exist.

```yaml
version: 2
specifications:
  documents:
    - match: specs/**/*.md
      scope: current
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
runners:
  project-tests:
    module: ./.focused-spec/runners/project-tests.ts
    timeoutMs: 120000
```

Every document layout either has `scope: <name>` and no `{scope}` token, or has exactly one `{scope}` token and no `scope` property. Scope names are path-safe and uniform; `baseline` has no reserved behavior. Patterns and exclusions are project-relative. The CLI does not infer evidence or archive exclusions from the surrounding framework. Register every evidence runner under `.focused-spec/runners/`; its module must stay inside the project and use `.ts`, `.mts`, `.js`, or `.mjs`.

## Adopt native scenarios incrementally

Enrollment is per scenario block. Any labeled `ID`, `EVIDENCE`, or `REVISES` row enrolls that block, even when the row is malformed; once marked, invalid focused metadata must fail validation rather than being treated as native prose. A configured document may mix enrolled blocks with native scenario blocks that contain none of those markers.

Unenrolled native blocks are ignored for focused validation and execution, but full validation and `run` count them as `unenrolledScenarios`. Keep that count visible and describe coverage honestly: passing focused evidence proves only the enrolled selection that ran. With no `--scope`, legacy-only scopes may coexist with enrolled scopes, but a discovered all-native document set is an error. Explicitly selecting a native-only scope is also an error.

For an existing specification, adopt one independently failing scenario at a time:

1. Before the host workflow changes or moves documents, inventory focused IDs, evidence references, and the unmarked owner plus `REVISES` edges for reused IDs.
2. Enroll the chosen scenario. Put its unmarked owner in a durable document that will remain discoverable; if a working scope repeats the ID, revise that owner explicitly.
3. Choose the exact runner and selector, using `planned:` only until the real test exists. Implement the test and replace the planned row.
4. Let the host framework perform whatever document transformation it owns. No particular framework lifecycle is required.
5. Compare the discovered after-state with the inventory: IDs and evidence remain, revision edges resolve, and every reused ID still reaches one durable unmarked owner after any working document leaves discovery.
6. Run the final selected scenario or scope. A structural or native-framework check is not a substitute for executing its evidence.

## Implement a runner only when evidence needs one

**Read [the bundled runner workflow](references/runners.md) when creating or changing a runner.** It is part of this skill, not a link into the focused-spec repository. Start sequentially with `resolve` and `run` using the public `focused-spec/runner` types. Prove one selected test really executed before claiming `pass`; do not use a pretend runner or copy another project's test-source parser. Add optional `partition` and `execution.maxConcurrentGroups > 1` only after auditing the selected tests' shared resources and proving every group reports its own actual results. The default concurrency limit is 1.

## Prove new or changed evidence detects failure

When implementing a new or changed evidence reference, including one that points to an existing test, check that the selected test fails for the outcome it claims to protect. First run that exact evidence and observe `PASS`. In a disposable workspace or with a reversible change that preserves user work, introduce one controlled regression in the product behavior described by its `THEN` (not in the test, selector, runner, or assertion). Run the same evidence again: the selected test must execute and `FAIL` on its behavioral assertion. A missing target, runner error, skip, or unrelated test failure does not prove sensitivity. Restore the original behavior even if the probe fails, then rerun the same evidence and observe `PASS`. Do this for each independently failing new or changed outcome; a runner that fabricates `pass` or a vacuous test must not pass this check. If the regression cannot be introduced safely, explain what was not checked and why; do not claim the evidence is mutation-verified.

## Verify

While any scope intentionally contains `planned:` evidence, run `focused-spec validate --scope <name>`; add `--syntax-only` to check authoring shape alone. This requires project configuration with the referenced runner registered. If the host workflow does not permit creating the necessary configuration and real runner yet, validate the proposal with the host's own command and report focused-spec validation as deferred; do not claim that planned evidence ran. Do not use strict validation or execution as a planning check.

After replacing planned evidence, run `focused-spec run --scope <name>` for one completed scope or `focused-spec run` for every discovered scope. `run` performs strict validation before execution. `focused-spec validate --scope <name> --strict` is an optional validation-only preflight, not a substitute for execution. Without `--scope`, validation and execution both select all discovered scopes; with it, both select only that scope. `run --scenario <id>` strictly validates and executes only matching scenarios in the selected scope(s), including all matching revisions if `--scope` is absent. It does not certify unrelated scenarios; run the full scope after replacing their planned evidence. Use `--allow-skip` only for an explicit project policy; `SKIP` and `ERROR` are not success otherwise. A native SDD check cannot replace focused-spec validation or execution.
