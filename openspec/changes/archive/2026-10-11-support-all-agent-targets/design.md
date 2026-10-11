# Design

## Context

See proposal.md for the goal. The baseline is the actual published `@fission-ai/openspec@1.14.1` CLI and its packaged target/adapter registry, not its lagging supported-tools Markdown. Prior investigation executed real isolated init for all 50 targets, all/combined selections, Windsurf alias, and commands-only Codex delivery: `evals/results/openspec-latest-init-research-1791745326335.json`. No target is dropped. The current loader already resolves the consuming project rather than its own skill directory, including when installed globally; do not rewrite portable guidance.

## Goals / Non-Goals

**Goals:** Complete target parity with the inspected release, native delivery, safe explicit selection and multi-root writes, exact behavioral evidence.

**Non-Goals:** No upstream runtime dependency, automatic tracking of future releases, legacy directory migration/deletion, global package installation, host config edits, Copilot cloud workflow setup, profiles, all/none selector aliases, release or publish. These are separate OpenSpec features, not targets requested by the user. The MiniMax global skill is included, not excluded as a project-local non-goal.

## Decisions

### Fixed catalog and destination table

Keep fixed package-owned data in `src/init-targets.ts`, used by installer, help and selection; do not load OpenSpec or fetch target mappings at runtime. Expose no new public package API. A destination records its trusted base (project or canonical home), project/home-relative path, package asset path, and reported path. Installer logic stays in `src/init.ts`; reuse existing preflight, no-op, exclusive-create and replacement rechecks instead of a parallel installer.

Paths below replace OpenSpec workflow names with `focused-spec`. Namespaced OpenSpec command directories such as `commands/opsx` are removed for the standalone focused-spec command. Existing OMP/Claude paths remain unchanged.

| Canonical ID | Loader destination | Command destination |
| --- | --- | --- |
| `amazon-q` | `.amazonq/skills/focused-spec/SKILL.md` | `.amazonq/prompts/focused-spec.md` |
| `amp` | `.agents/skills/focused-spec/SKILL.md` | skills only |
| `antigravity` | `.agents/skills/focused-spec/SKILL.md` | `.agents/workflows/focused-spec.md` |
| `atomcode` | `.atomcode/skills/focused-spec/SKILL.md` | `.atomcode/commands/focused-spec.md` |
| `auggie` | `.augment/skills/focused-spec/SKILL.md` | `.augment/commands/focused-spec.md` |
| `bob` | `.bob/skills/focused-spec/SKILL.md` | `.bob/commands/focused-spec.md` |
| `claude` | `.claude/skills/focused-spec/SKILL.md` | `.claude/commands/focused-spec.md` |
| `cline` | `.cline/skills/focused-spec/SKILL.md` | `.clinerules/workflows/focused-spec.md` |
| `command-code` | `.commandcode/skills/focused-spec/SKILL.md` | `.commandcode/commands/focused-spec.md` |
| `codeartsagent` | `.codeartsdoer/skills/focused-spec/SKILL.md` | skills only |
| `codex` | `.agents/skills/focused-spec/SKILL.md` | skills only |
| `dsh` | `.dsh/skills/focused-spec/SKILL.md` | skills only |
| `devin` | `.devin/skills/focused-spec/SKILL.md` | `.devin/workflows/focused-spec.md` |
| `forgecode` | `.forge/skills/focused-spec/SKILL.md` | skills only |
| `codebuddy` | `.codebuddy/skills/focused-spec/SKILL.md` | `.codebuddy/commands/focused-spec.md` |
| `codestudio` | `.codestudio/skills/focused-spec/SKILL.md` | `.codestudio/prompts/focused-spec.prompt.md` |
| `continue` | `.continue/skills/focused-spec/SKILL.md` | `.continue/prompts/focused-spec.prompt` |
| `costrict` | `.cospec/skills/focused-spec/SKILL.md` | `.cospec/openspec/commands/focused-spec.md` |
| `crush` | `.crush/skills/focused-spec/SKILL.md` | `.crush/commands/focused-spec.md` |
| `cursor` | `.cursor/skills/focused-spec/SKILL.md` | `.cursor/commands/focused-spec.md` |
| `easycode` | `.easycode/skills/focused-spec/SKILL.md` | `.easycode/commands/focused-spec.toml` |
| `factory` | `.factory/skills/focused-spec/SKILL.md` | `.factory/commands/focused-spec.md` |
| `gemini` | `.gemini/skills/focused-spec/SKILL.md` | `.gemini/commands/focused-spec.toml` |
| `github-copilot` | `.github/skills/focused-spec/SKILL.md` | `.github/prompts/focused-spec.prompt.md` |
| `gigacode` | `.gigacode/skills/focused-spec/SKILL.md` | `.gigacode/commands/focused-spec.md` |
| `grok` | `.grok/skills/focused-spec/SKILL.md` | skills only |
| `gsd` | `.agents/skills/focused-spec/SKILL.md` | skills only |
| `hermes` | `.hermes/skills/focused-spec/SKILL.md` | skills only |
| `iflow` | `.iflow/skills/focused-spec/SKILL.md` | `.iflow/commands/focused-spec.md` |
| `junie` | `.junie/skills/focused-spec/SKILL.md` | `.junie/commands/focused-spec.md` |
| `kilocode` | `.kilocode/skills/focused-spec/SKILL.md` | `.kilo/command/focused-spec.md` |
| `kimi` | `.kimi-code/skills/focused-spec/SKILL.md` | skills only |
| `kiro` | `.kiro/skills/focused-spec/SKILL.md` | `.kiro/prompts/focused-spec.prompt.md` |
| `lingma` | `.lingma/skills/focused-spec/SKILL.md` | `.lingma/commands/focused-spec.md` |
| `minimax-code` | `~/.minimax/skills/focused-spec/SKILL.md` | skills only |
| `vibe` | `.vibe/skills/focused-spec/SKILL.md` | skills only |
| `oh-my-pi` | `.omp/skills/focused-spec/SKILL.md` | `.omp/commands/focused-spec.md` |
| `opencode` | `.opencode/skills/focused-spec/SKILL.md` | `.opencode/commands/focused-spec.md` |
| `pi` | `.pi/skills/focused-spec/SKILL.md` | `.pi/prompts/focused-spec.md` |
| `codeassistant` | `.codeassistant/skills/focused-spec/SKILL.md` | `.codeassistant/commands/focused-spec.md` |
| `qoder` | `.qoder/skills/focused-spec/SKILL.md` | `.qoder/commands/focused-spec.md` |
| `qwen` | `.qwen/skills/focused-spec/SKILL.md` | `.qwen/commands/focused-spec.md` |
| `rovodev` | `.rovodev/skills/focused-spec/SKILL.md` | skills only |
| `roocode` | `.roo/skills/focused-spec/SKILL.md` | `.roo/commands/focused-spec.md` |
| `trae` | `.trae/skills/focused-spec/SKILL.md` | `.trae/commands/focused-spec.md` |
| `veai` | `.veai/skills/focused-spec/SKILL.md` | skills only |
| `warp` | `.warp/skills/focused-spec/SKILL.md` | skills only |
| `zed` | `.agents/skills/focused-spec/SKILL.md` | skills only |
| `zcode` | `.zcode/skills/focused-spec/SKILL.md` | `.zcode/commands/focused-spec.md` |
| `agents` | `.agents/skills/focused-spec/SKILL.md` | skills only |

Alias `windsurf` normalizes to `devin` before deduplication and reporting. Do not write `.windsurf`. Shared-root IDs are `amp`, `antigravity`, `codex`, `gsd`, `zed`, `agents`; use one byte-identical loader without a vendor-specific body or ownership marker. Antigravity additionally gets its `.agents/workflows/focused-spec.md` wrapper. No `.codex` files are created.

### Native wrappers and invocation

34 bundled wrappers request loading the same focused-spec skill and applying its returned workflow to the supplied task. They must not embed the workflow, OpenSpec operations, new tool permissions, or references to `opsx`. Preserve existing OMP/Claude assets unless argument correctness requires an in-scope change.

- YAML/Markdown hosts: only required/recognized metadata; command name/ID must be focused-spec, not a copied `opsx-focused-spec`. Claude must not inherit upstream `allowed-tools: Bash(openspec:*)`.
- AtomCode: unquoted `name: focused-spec`, `args: optional`, `$ARGUMENTS` input.
- Continue: `.prompt`, matching `name: focused-spec`, `invokable: true`, retain instruction that the prompt is active rather than a tool name.
- Gemini/EasyCode: valid TOML `description`/`prompt` and native `{{args}}` when supplied args need injection.
- Command Code/OpenCode: explicit `$ARGUMENTS`. Pi uses `$@`; OMP accepts the existing `$ARGUMENTS` and also `$@`. Claude retains `$ARGUMENTS`. Other hosts use documented native interpolation or their injected user request, not blindly copied placeholders. Verify formats and argument handling against host contracts while implementing; finish every adapter, do not substitute empty wrappers.
- Amazon Q uses `@focused-spec`. Codex uses `$focused-spec`. Kimi uses `/skill:focused-spec`; command-file hosts ordinarily use `/focused-spec`. Rovo/GSD/SourceCraft skills use natural-language skill requests when no command surface applies. Universal targets do not promise one slash syntax. Hermes gets an actionable `skills.external_dirs` hint, not a config edit. Copilot command support is for IDE prompt files; no cloud workflow or CLI prompt claim.

### MiniMax global boundary and reports

Only selecting `minimax-code` authorizes `~/.minimax/skills/focused-spec/SKILL.md`. Interactive display names that absolute/global destination before confirmation. Resolve the existing home root through the platform home-directory API and canonical realpath only when needed; do not create a missing home or infer it from the project. Keep the selected existing project root mandatory. Apply identical symlink/non-directory/non-regular checks below each canonical root. Global selection creates no project `.minimax` or `.mavis`, command, settings, manifest or global dependency. Selecting project targets alone must not read/modify home integration paths.

The JSON envelope remains `{ root, tools, dryRun, files, errors }`. `root` stays the canonical project root. Project-local file/error paths remain project-relative; MiniMax file/error paths are canonical absolute paths. This exception avoids inventing relative traversal paths or redesigning all existing JSON consumers. Normalize reported tools to canonical IDs. Resolve/deduplicate actual destination identity before planning; preflight every asset and destination across both bases before any write. A known conflict/unsafe path/missing asset in either base prevents all writes in both. Preview changes neither base. Replace authorizes only selected skill/wrapper files, never symlinks or neighboring/global settings. Recheck destination state before writes and report later partial I/O honestly.

### Exact files for implementation and lifecycle

Source: `src/init.ts`, new `src/init-targets.ts`. Existing CLI routing stays in `src/cli.ts` unless its help integration requires an actual change. Tests: `test/cli.spec.ts`, `test/package.spec.ts`, new independent `test/fixtures/agent-targets.json` (expected destinations, wrapper grammar and argument convention; never derive expected values from the production catalog). No package dependency/export or config edits.

Bundled wrappers to create/update, with no arbitrary documentation files:

- `skills/commands/amazon-q/focused-spec.md`
- `skills/commands/antigravity/focused-spec.md`
- `skills/commands/atomcode/focused-spec.md`
- `skills/commands/auggie/focused-spec.md`
- `skills/commands/bob/focused-spec.md`
- `skills/commands/claude/focused-spec.md`
- `skills/commands/cline/focused-spec.md`
- `skills/commands/command-code/focused-spec.md`
- `skills/commands/devin/focused-spec.md`
- `skills/commands/codebuddy/focused-spec.md`
- `skills/commands/codestudio/focused-spec.prompt.md`
- `skills/commands/continue/focused-spec.prompt`
- `skills/commands/costrict/focused-spec.md`
- `skills/commands/crush/focused-spec.md`
- `skills/commands/cursor/focused-spec.md`
- `skills/commands/easycode/focused-spec.toml`
- `skills/commands/factory/focused-spec.md`
- `skills/commands/gemini/focused-spec.toml`
- `skills/commands/github-copilot/focused-spec.prompt.md`
- `skills/commands/gigacode/focused-spec.md`
- `skills/commands/iflow/focused-spec.md`
- `skills/commands/junie/focused-spec.md`
- `skills/commands/kilocode/focused-spec.md`
- `skills/commands/kiro/focused-spec.prompt.md`
- `skills/commands/lingma/focused-spec.md`
- `skills/commands/oh-my-pi/focused-spec.md`
- `skills/commands/opencode/focused-spec.md`
- `skills/commands/pi/focused-spec.md`
- `skills/commands/codeassistant/focused-spec.md`
- `skills/commands/qoder/focused-spec.md`
- `skills/commands/qwen/focused-spec.md`
- `skills/commands/roocode/focused-spec.md`
- `skills/commands/trae/focused-spec.md`
- `skills/commands/zcode/focused-spec.md`

Evidence: `.focused-spec/evidence/agent-init.yaml`, `.focused-spec/evidence/cli-help.yaml` (both already glob-covered). Documentation: `docs/guides/install.md`, `docs/reference/cli.md`, `docs/guides/README.md`, `docs/reference/README.md`, `docs/README.md`. Native lifecycle: this change’s `.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md`, `specs/agent-init/spec.md`, `specs/cli-help/spec.md`; publication modifies `openspec/specs/agent-init/spec.md`, `openspec/specs/cli-help/spec.md`; archive moves this complete directory to the host-derived dated archive. No edits to other active changes.

### Executable evidence plan

Planning only: do not write executable registry/config/runner entries until implementation is authorized. In apply, add working-scope entries to the existing capability shards; replace planned refs only once their target exists. Existing affected IDs retain these intended exact tests with assertions updated only for changed behavior:

```yaml
scopes:
  support-all-agent-targets:
    init.install.selected-targets:
      evidence:
        - vitest::test/package.spec.ts::package distribution > installs selected agent integrations offline from the packed package
    init.install.shared-root:
      evidence:
        - vitest::test/package.spec.ts::package distribution > deduplicates Codex and shared agent destinations
    init.install.no-runtime-setup:
      evidence:
        - vitest::test/package.spec.ts::package distribution > installs agent integration without manufacturing evidence setup
    init.selection.explicit:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > requires explicit init targets without interactive input
    init.selection.interactive:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > installs only confirmed interactive init targets
    init.selection.invalid:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid init arguments before writing files
    init.reinit.unchanged:
      evidence:
        - vitest::test/package.spec.ts::package distribution > leaves identical agent integrations unchanged on reinitialization
    init.reinit.conflict:
      evidence:
        - vitest::test/package.spec.ts::package distribution > preserves custom integrations and aborts all writes on conflict
    init.reinit.replace:
      evidence:
        - vitest::test/package.spec.ts::package distribution > replaces only explicitly selected integration files
    init.preview.no-writes:
      evidence:
        - vitest::test/package.spec.ts::package distribution > previews installation and replacement without filesystem writes
    init.boundary.unsafe-destination:
      evidence:
        - vitest::test/package.spec.ts::package distribution > rejects unsafe integration destinations without modifying either tree
    init.boundary.invalid-root:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > rejects unavailable init roots without creating a project
    init.assets.unavailable:
      evidence:
        - vitest::test/package.spec.ts::package distribution > rejects incomplete bundled init assets before writing integrations
    init.output.json:
      evidence:
        - vitest::test/cli.spec.ts::focused-spec CLI > reports actual init actions and conflicts as one JSON document
```

New independently failing native items:

| Native ID | Intended exact evidence |
| --- | --- |
| `init.targets.catalog` | `planned:vitest::test/package.spec.ts::package distribution > installs every OpenSpec 1.14.1 agent target from the packed package` |
| `init.targets.native-formats` | `planned:vitest::test/package.spec.ts::package distribution > installs host-readable wrappers with native argument handling` |
| `init.targets.alias` | `planned:vitest::test/package.spec.ts::package distribution > normalizes Windsurf selection to Devin without legacy writes` |
| `init.global.minimax` | `planned:vitest::test/package.spec.ts::package distribution > installs MiniMax integration only into the explicitly selected home root` |
| `init.global.preview` | `planned:vitest::test/package.spec.ts::package distribution > previews mixed project and home integration without writes` |
| `init.global.conflict` | `planned:vitest::test/package.spec.ts::package distribution > aborts project and home writes together on any integration conflict` |
| `init.global.replace` | `planned:vitest::test/package.spec.ts::package distribution > replaces only selected MiniMax integration and preserves neighboring files` |
| `init.global.unsafe` | `planned:vitest::test/package.spec.ts::package distribution > rejects unsafe home destinations without modifying either tree` |
| `init.global.reporting` | `planned:vitest::test/package.spec.ts::package distribution > reports canonical home destinations and completed global writes` |

`cli.help.init` uses `vitest::test/cli.spec.ts::focused-spec CLI > explains initialization without reading or modifying project state`, expanded to verify the catalog/alias/global warning. Use all selected targets in new catalog coverage and existing reinitialization/replacement safety checks where appropriate; do not pin cosmetic output. Format/argument tests parse installed content using actual YAML/TOML/native prompt grammar and exercise representative available host surfaces; unavailable agent runtimes are limitations, not activation passes.

All consumer checks invoke the packed installed executable offline, outside the source checkout. Isolate HOME for every MiniMax path. The matrix independently checks all 50 destinations and exact unwanted-path absence, aliases and shared deduplication. Global cases protect fresh install, preview, cross-root conflicts, narrow replacement, unsafe ancestors/destinations, and absolute JSON reporting. Keep existing empty/Ctrl-C/EOF PTY proof. `npm test`, native strict checks, scoped validate/run, product sensitivity PASS → assertion FAIL → restore PASS for every new/changed outcome, sync/archive, then all-scope validate/run are completion gates. Proof files may be written only as fresh ignored `evals/results/*.json`; do not overwrite historical results.

## Risks / Trade-offs

- Home writes widen the old project-only boundary; explicit MiniMax selection and canonical absolute reporting make that authority visible. No general global installer is introduced.
- 50-target support is an audited versioned snapshot, not a promise of all future OpenSpec releases. Paths may drift; update through a new checked change.
- Native wrapper installation is not proof of all 50 runtime activations. Exercise available hosts, parse remaining formats, report the actual verified surface.
- Filesystem preflight is not a sandbox against malicious races or an atomic transaction. Preserve current rechecks and honest completed-write reporting.
- Hermes and Copilot variants require external host setup/specific surfaces; provide correct hints without secretly editing host config.
