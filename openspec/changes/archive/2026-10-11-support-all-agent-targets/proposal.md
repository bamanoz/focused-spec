# Proposal

## Why

The installer accepts only four targets while the user's installed OpenSpec 1.14.1 supports 50 canonical targets. The user requested all OpenSpec targets, not a subset or generic fallback; each target needs its actual skill root and native command delivery where supported.

## What Changes

- Support the complete 50-target OpenSpec 1.14.1 catalog and its `windsurf` alias for `devin`, with fixed package-owned mappings and no OpenSpec runtime dependency or network discovery.
- Install the same bundled thin loader for every selected target, deduplicating shared `.agents/skills` destinations across Amp, Antigravity, Codex, GSD, Zed, and the vendor-neutral target.
- Bundle minimal native command/prompt/workflow wrappers for the 34 targets with OpenSpec command adapters, using focused-spec names, host metadata and argument handling rather than OpenSpec workflow content or permission rules. Keep the 16 skills-only targets skills-only.
- Support MiniMax Code's actual global-only skill root, `~/.minimax/skills/focused-spec/SKILL.md`, only when explicitly selected or interactively confirmed; do not fake project-local support. All other assets remain project-local. Keep the same cross-destination preflight, preservation, replacement and preview guarantees across both roots.
- **BREAKING (global selection only):** init JSON keeps its existing keys but may report an absolute canonical-home file/error path for MiniMax Code; project-local paths stay project-relative. Human output and help explicitly identify the global destination. No new general-purpose global-install flag is introduced.
- Extend target discovery/help and target-specific invocation/setup hints. Shared/automatic skill hosts must not be assigned a fictional universal slash command; Hermes needs an explicit external-directory configuration hint without editing its config.
- Exercise all targets from a packed offline installation with isolated HOME; retain existing CLI/PTY and conflict/safety checks, register exact scoped evidence, run sensitivity probes, update owning docs, then sync/archive the completed change.

## Capabilities

### New Capabilities

None. The existing initialization capability owns this expansion.

### Modified Capabilities

- `agent-init`: full target catalog, native delivery, alias normalization, shared-root deduplication, global MiniMax exception, multi-root safety and reporting.
- `cli-help`: initialization help describes the complete catalog and explicit global boundary.

## Impact

Source: `src/init.ts` and a small fixed catalog in `src/init-targets.ts`; no public package API, dependency installation, OpenSpec runtime dependency, or npm lifecycle side effects. Assets: existing loader unchanged; native wrappers under `skills/commands/<target>/` as enumerated in design. Checks: `test/cli.spec.ts`, `test/package.spec.ts`, and `test/fixtures/agent-targets.json` with independently checked path/format expectations. Evidence: existing `.focused-spec/evidence/agent-init.yaml` and `.focused-spec/evidence/cli-help.yaml`; no config change because the existing glob covers them. Docs: `docs/guides/install.md`, `docs/reference/cli.md`, their section indexes, and `docs/README.md`. OpenSpec artifacts and final master specs are enumerated in design. No release, publish, commit, user-home installation during tests, or implicit project-agent migration.
