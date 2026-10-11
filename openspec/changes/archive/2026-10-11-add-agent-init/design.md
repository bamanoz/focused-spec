## Context

The approved direction is an explicit bundled agent installer, not project evidence bootstrapping. The package already contains `skills/focused-spec/SKILL.md`, whose thin loader resolves the consuming project's installed CLI and requests authoritative protocol-1 guidance. npm installation remains side-effect-free.

Research used real isolated OpenSpec 1.6.0 init/reinit runs: it creates its owned specification/configuration structure and copies bundled skills/commands; reinit preserves config but overwrites a customized generated skill. Current [upstream tool mappings](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md) differ from that installed version, notably Codex's shared `.agents/skills` and skills-only delivery. We reuse explicit selection and bundled installation, not unconditional replacement, global settings, profiles, or OpenSpec's ownership of specification directories. Recorded experiment: `evals/results/openspec-init-research-1791733659672.json` (local ignored evidence, not a shipped asset).

## Goals / Non-Goals

**Goals:**

- Install discoverable project-local agent integration from the invoked package without network access.
- Give interactive users explicit selection and scripts deterministic preview/reporting.
- Preserve custom files by default, deduplicate shared targets, and restrict writes to known integration destinations.
- Make reinitialization, explicit replacement, errors, and installation-only success observable.

**Non-Goals:**

- Automatic evidence configuration, runners, native specs, global installation, `AGENTS.md` edits, npm postinstall, or claiming evidence readiness.
- A second full-text workflow, profiles, a target-state manifest, background synchronization, or an independent update command.
- Implementing init in this proposal phase, release/publish, or resolving the separately requested current eval failures inside this change.

## Decisions

### 1. CLI and selection

`focused-spec init [path] [--tools <comma-separated IDs>] [--dry-run] [--json] [--replace]` targets the explicitly supplied existing directory, or cwd; it never searches upward for another project. Require an existing directory so a typo cannot create an unintended project. Resolve that root canonically once. Init routes before evidence configuration loading.

Supported IDs are exactly `oh-my-pi`, `claude`, `codex`, and `agents`. Trim individual comma-separated IDs, reject empty or unknown IDs, and deduplicate repeated IDs. `all` and `none` are not magic targets. Without `--tools`, an interactive invocation presents all supported choices, suggests targets from their existing project directories, and requires a nonempty confirmed selection. Cancellation writes nothing and exits nonzero. A non-TTY or `--json` invocation requires `--tools` even if target directories already exist; detection is not consent. `--replace` itself authorizes replacement; no second implicit prompt changes scripted semantics.

### 2. Fixed targets and package-owned assets

| ID | Loader destination | Wrapper destination |
| --- | --- | --- |
| `oh-my-pi` | `.omp/skills/focused-spec/SKILL.md` | `.omp/commands/focused-spec.md` |
| `claude` | `.claude/skills/focused-spec/SKILL.md` | `.claude/commands/focused-spec.md` |
| `codex` | `.agents/skills/focused-spec/SKILL.md` | none |
| `agents` | `.agents/skills/focused-spec/SKILL.md` | none |

Copy the bundled loader verbatim using package-relative asset lookup, never cwd or a remote download. OMP/Claude wrappers are bundled minimal instructions to load that project's focused-spec skill and apply it to the supplied task; no behavioral procedure is duplicated. Print native invocation hints (`/focused-spec` for wrappers, `$focused-spec` for Codex); shared skills have host-dependent invocation, not a universal slash-command claim. Deduplicate destinations before planning when both `codex` and `agents` are selected. Use ordinary copies rather than symlinks into node_modules. Missing/unreadable/empty package assets abort before mutation.

The invoked package supplies installation assets. The loader subsequently resolves the consuming project's local package for authoritative instructions; init does not silently install that dependency or substitute its own/global CLI for it. Installation success therefore does not prove loader activation, a compatible local dependency, runner setup, or executed evidence.

### 3. Preflight and reinitialization

Build a deterministic plan for every unique destination before creating directories or writing any file. A missing regular-file destination is `install`; byte-identical content is `unchanged`; divergent regular-file content is `conflict`, or `replace` with explicit `--replace`. A conflict aborts the entire preflight without installing otherwise missing files. `--replace` does not authorize arbitrary deletion or write access: destination directories, symlinked destinations/ancestors, non-directory ancestors, or paths escaping the canonical root remain errors. Do not remove extra files in a skill directory or touch unselected integrations.

Reject symlinks beneath the canonical project root in planned destination chains, even if they currently point inside the project; accepting them adds ownership/race ambiguity for little benefit. This restriction does not reject a symlink used to name the project root itself, whose resolved directory defines the selected root. Recheck destination state immediately before writes and fail rather than clobber a concurrently changed file. Preflight gives no-mutation guarantees for known conflicts/unsafe paths, not a full multi-file transaction under arbitrary I/O failure. Report any completed writes if a later write fails; never claim an all-or-nothing filesystem transaction or silently delete user work to roll back.

### 4. Preview, reporting, and failures

`--dry-run` performs the same asset, argument, root, destination, and conflict checks but creates no directories/files. `--replace --dry-run` previews replacements. A conflict or invalid destination still exits 1; dry-run is not permission to ignore an error. Success exits 0, failure/cancellation exits 1. Human output lists actions/paths and explicitly identifies agent integration only. Existing config is neither interpreted nor modified.

JSON output is one document: `{ root, tools, dryRun, files, errors }`, with `root` the canonical absolute selected root (or null if root resolution failed), `tools` the normalized distinct requested IDs, `dryRun` a boolean, `files` entries `{ path, action, applied }`, and `errors` entries `{ path?, message }`. `path` is project-relative for planned files, `action` is `install|unchanged|replace|conflict`, and `applied` is true only for completed install/replace writes. Successful dry-run has no applied writes; unchanged files are never claimed written. Keep diagnostics on stderr as well as structured errors when applicable; stdout contains no progress prose in JSON mode. Known unsafe paths may be reported as errors without a file action. Help remains human-readable and side-effect-free even with `--json`.

### 5. Small implementation boundary

Prefer one CLI-only `src/init.ts` module for explicit adapters, planning, and copying, reusing package-relative asset and CLI argument conventions. Keep terminal selection at the CLI boundary and use existing dependencies where applicable; do not add a framework or installer abstraction for four mappings. No new public TypeScript export is required. Extend CLI/help tests and packed-package consumer tests through real commands. Owning docs are `docs/guides/install.md`, `docs/reference/cli.md`, their indexes if changed, and `docs/README.md` for the new capability after publication; do not replace the authoritative workflow with repository procedure copies.

## Executable evidence plan

This is planning-only: every selector below is intended apply-stage evidence, not an assertion that init exists or tests ran. Do not create evidence-registry/configuration/runner files for this proposal. At apply, bind each marker to its own scope-local registry entry and replace `planned:` only after its real target exists.

| Native ID | Intended exact evidence |
| --- | --- |
| `init.install.selected-targets` | `planned:vitest::test/package.spec.ts::package distribution > installs selected agent integrations offline from the packed package` |
| `init.install.shared-root` | `planned:vitest::test/package.spec.ts::package distribution > deduplicates Codex and shared agent destinations` |
| `init.install.no-runtime-setup` | `planned:vitest::test/package.spec.ts::package distribution > installs agent integration without manufacturing evidence setup` |
| `init.selection.explicit` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > requires explicit init targets without interactive input` |
| `init.selection.interactive` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > installs only confirmed interactive init targets` |
| `init.selection.invalid` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid init arguments before writing files` |
| `init.reinit.unchanged` | `planned:vitest::test/package.spec.ts::package distribution > leaves identical agent integrations unchanged on reinitialization` |
| `init.reinit.conflict` | `planned:vitest::test/package.spec.ts::package distribution > preserves custom integrations and aborts all writes on conflict` |
| `init.reinit.replace` | `planned:vitest::test/package.spec.ts::package distribution > replaces only explicitly selected integration files` |
| `init.preview.no-writes` | `planned:vitest::test/package.spec.ts::package distribution > previews installation and replacement without filesystem writes` |
| `init.boundary.unsafe-destination` | `planned:vitest::test/package.spec.ts::package distribution > rejects unsafe integration destinations without modifying either tree` |
| `init.boundary.invalid-root` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > rejects unavailable init roots without creating a project` |
| `init.assets.unavailable` | `planned:vitest::test/package.spec.ts::package distribution > rejects incomplete bundled init assets before writing integrations` |
| `init.output.json` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > reports actual init actions and conflicts as one JSON document` |
| `cli.help.overview` | existing `vitest::test/cli.spec.ts::focused-spec CLI > discovers commands and native options without reading project state` |
| `cli.help.init` | `planned:vitest::test/cli.spec.ts::focused-spec CLI > explains initialization without reading or modifying project state` |

Reuse existing `distribution.skill.separate-install` evidence to defend npm-only no-side-effects behavior. Consumer checks must exercise the packed installed executable with network disabled/unavailable and source checkout inaccessible. Audit bytes and directory trees, not just exit codes or generated-file counts. Conflict checks include an otherwise missing second target to prove no partial preflight installation; replacement checks retain custom neighboring files and unselected targets; symlink checks retain the outside tree. Interactive selection/cancellation needs a real PTY exercise of the CLI, not a mock echo; if a portable suite cannot provide it, retain the deterministic boundary test and record the actual terminal smoke separately. Run actual OMP/Claude discovery/invocation for the minimal wrappers and Codex skill loading where those runtimes are available; otherwise report that limitation rather than infer routing from files. Execute focused selected evidence, behavioral regressions/restoration, `npm test`, and the relevant packed consumer CLI smoke before completing implementation.

## Risks / Trade-offs

- Agent conventions change → maintain the small explicit mapping and verify actual runtimes; do not copy OpenSpec's obsolete Codex adapter.
- A discoverable skill is not guaranteed to be loaded → state installation-only success; never claim agent compliance from a copied file.
- A newer package's assets differ → explicit replacement is required; conservative custom-file preservation costs one extra deliberate operation.
- Filesystem writes are not a sandbox or an atomic transaction against hostile concurrent mutation → validate/recheck ordinary project-owned paths and report partial I/O completion honestly.
- Wrapper content could drift into a second workflow → keep it solely a skill-loading entrypoint.
- Additional tested edge cases may emerge during apply → update this plan before widening target support or replacement authority.
