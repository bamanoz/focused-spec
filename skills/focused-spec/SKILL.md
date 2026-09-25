---
name: focused-spec
description: Connects focused behavioral scenarios to exact executable evidence using the installed CLI and project-local runners. Use when authoring or changing behavioral scenarios, configuring focused-spec, implementing a runner, or parallelizing evidence execution; use alongside any other spec workflow.
---

# Focused Spec

Author small scenarios in the host framework's Markdown, but use focused-spec's own IDs, evidence, and execution contract. The installed CLI and this bundled skill are sufficient; do not assume access to this skill's source repository.

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

Evidence is `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Baseline evidence is always concrete. Use `planned:` only in a named scope while that exact test is not implemented, then replace it before completion. To revise a baseline scenario in a named scope, keep its ID and add exactly one `- **REVISES**: baseline` row; never infer revision from framework headings.

## Configure when first needed

Create `.focused-spec/config.yaml` when the first scenario names evidence. Select only scenario-bearing Markdown and exclude archives explicitly; do not create root-level `focused-spec.yaml`.

```yaml
version: 2
specifications:
  documents:
    - match: specs/**/*.md
      scope: baseline
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
runners:
  project-tests:
    module: ./.focused-spec/runners/project-tests.ts
    timeoutMs: 120000
```

A baseline layout has `scope: baseline` and no `{scope}`; a named layout has one `{scope}` and no `scope` property. Patterns and exclusions are project-relative. The CLI does not infer evidence or archive exclusions from the surrounding framework. Register every evidence runner under `.focused-spec/runners/`; its module must stay inside the project and use `.ts`, `.mts`, `.js`, or `.mjs`.

## Implement a runner only when evidence needs one

**Read [the bundled runner workflow](references/runners.md) when creating or changing a runner.** It is part of this skill, not a link into the focused-spec repository. Start sequentially with `resolve` and `run` using the public `focused-spec/runner` types. Prove one selected test really executed before claiming `pass`; do not use a pretend runner or copy another project's test-source parser. Add optional `partition` and `execution.maxConcurrentGroups > 1` only after auditing the selected tests' shared resources and proving every group reports its own actual results. The default concurrency limit is 1.

## Verify

While a named scope intentionally contains `planned:` evidence, run `focused-spec validate --scope <name>`; add `--syntax-only` to check authoring shape alone. Do not use strict validation or execution as a planning check.

After replacing planned evidence, run `focused-spec run --scope <name>` for a completed scope or `focused-spec run` for the baseline when all named scopes are complete. `run` performs strict validation before execution. `focused-spec validate --scope <name> --strict` is an optional validation-only preflight, not a substitute for execution. Without `--scope`, validation covers the baseline and all discovered named scopes; `run` selects baseline execution. Use `--allow-skip` only for an explicit project policy; `SKIP` and `ERROR` are not success otherwise. A native SDD check cannot replace focused-spec validation or execution.
