# Design

## Context

See proposal.md for motivation. Protocol 1 already delivers workflow independent of project configuration. Published 0.5.0 genuinely supports version 2 and ships a full-text skill without `instructions`. Current CLI rejects that format; current guidance has no complete update procedure. npm latest is published 0.8.1, not this unpublished candidate.

## Goals / Non-Goals

**Goals:** Keep authority attached to the installed package and prove preservation independently of the agent's claims. Preserve original evidence per occurrence, including repeated IDs in different scopes.

**Non-Goals:** No automatic converter, old parser, compatibility alias, new protocol/topic, or release. This change does not replace host approval or authorize unrelated dependency/integration updates.

## Decisions

### Existing guidance transport, narrow loader bootstrap

Add the permanent migration procedure to `guidance/workflow.md`. The loader only distinguishes explicit upgrade authorization from ordinary fail-closed acquisition: install/update the requested project-local package, refresh selected bundled integration using `init`, then obtain the replacement package's full protocol response before migration. Ordinary missing/incompatible guidance still stops work. Preserve custom files and symlink safety; `--replace` does not make symlinks safe.

Both obsolete-format diagnostics give the same concrete local workflow request. Do not add a converter or inspect package implementation to discover migration steps.

### Genuine legacy baseline, ordinary npm upgrade

A new public `project-upgrade` case starts with published 0.5.0 and its actual full-text skill. Its blind prompt is only `Обнови focused-spec до последней версии.` A temporary loopback npm registry exposes the independently packed candidate as latest; unrelated packages use public npm. The fixture's registry setting is protected, so npm installation exercises real package replacement without publishing or supplying a tarball/path hint in the prompt. Close the registry when the eval ends, including retained-workspace runs.

The legacy fixture contains current blocked and active outcomes plus a repeated blocked ID in a captured `refresh` scope with REVISES. Native prose, exact scope/ID/reference inventories, runner modules/configuration and unrelated content are independently known. Current blocked and refresh blocked each require both Go and pytest. The active outcome has its own Go/pytest selectors. The old CLI must strictly validate and execute the baseline before the agent runs.

### Candidate bytes replace—not remove—integrity protection

Install the packed candidate into a separate evaluator-owned reference tree. Capture its complete file inventory/bytes and bundled loader into memory before the agent starts. Only this case replaces expected snapshots for the focused package and selected focused integration. All unrelated product/tests/runners/integrations remain protected. Final upgrade gates reject missing/extra candidate files, stale loader references, altered package bytes, lost/redirected native behavior or evidence, changed configuration outside the version/evidence setup, and changed unrelated manifest dependencies. Existing non-upgrade snapshots and gates are unchanged.

### Exact executable evidence

- `guidance.upgrade.obsolete-format`: `vitest::test/cli.spec.ts::focused-spec CLI > advertises executable workflow guidance for obsolete configuration and inline metadata` exercises the advertised arguments against the serving CLI, rather than pinning prose.
- `agent.upgrade.reject-loss`: `vitest::test/evals.spec.ts::agent eval harness > rejects lost scope-local evidence and tampered upgrade artifacts` checks independently valid migrations and adversarial loss/tampering against the same gates.
- `agent.upgrade.preserve-project`: the same deterministic preservation boundary is registered; the required real blind `project-upgrade` eval is separate model-specific evidence, not replaced by a fake driver.
- Fixture selectors: `go-unit::./auth::TestBlockedAccount`, `pytest-functional::tests/functional/test_auth.py::test_blocked_account`, `go-unit::./auth::TestValidActiveAccount`, `pytest-functional::tests/functional/test_auth.py::test_valid_active_account`. Preserve exact references even where alternatives could execute equivalent tests.

Run the real migrated CLI with independently verified PASS → selected behavioral assertion FAIL → restored PASS for both languages. Run every newly discovered public case and all seven native hosts in revision/create modes. Keep immutable transcripts/results and report model-specific failures and unverified native validation/lifecycle honestly.

## Risks / Trade-offs

- Legacy full-text skill cannot know future procedures → agent discovers the new public package/loader through the ordinary update request, then uses fresh authority.
- A loopback registry could conceal fake installation → install genuine old and candidate tarballs and independently compare every candidate file; do not substitute package metadata or fake npm output.
- State-only validation cannot detect historical loss → preserve a separate expected occurrence/behavior inventory in the evaluator.
- Custom instructions or unsafe symlinks can block replacement → retain them, use host approval/safe installer workflows, and report the actual unresolved destination rather than force it.
- Agent outcomes are nondeterministic → retain first unchanged-model outcomes and never claim general capability from a single pass.

## Migration Plan

Ship updated assets and diagnostics in a future separately authorized release. Existing users explicitly requesting an upgrade refresh local CLI and installed focused integration, obtain current workflow, migrate metadata and validate/run every retained occurrence. No install-time conversion. Leave this OpenSpec change active until sync/archive is explicitly requested.
