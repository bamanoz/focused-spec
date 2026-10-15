# agent-init Specification

## Purpose

Explicit bundled agent integration across the complete target catalog, with deliberate selection, native delivery, conflict preservation, safe project/home previews, and installation-only reporting.

## Requirements

### Requirement: Explicit bundled project-local installation
The CLI SHALL provide `init [path] [--tools <IDs>] [--dry-run] [--json] [--replace]` using only invoked-package assets, without downloads, OpenSpec, repository implementation or evidence config. It SHALL install each catalog loader, plus native wrappers for 34 command targets and none for 16 skills-only targets. Wrappers SHALL not embed workflow, OpenSpec names or permissions. Existing OMP/Claude paths SHALL remain unchanged.

<!-- focused-spec:id=init.install.selected-targets -->
#### Scenario: Selected integrations install offline
- **WHEN** a consumer invokes the packed installed CLI with explicit Oh My Pi and Claude targets in an existing project without network or source-checkout access
- **THEN** the selected loaders and skill-loading wrappers are installed from that package, with no unselected agent integration or remote download

<!-- focused-spec:id=init.install.shared-root -->
#### Scenario: Codex and shared targets have one destination
- **WHEN** a consumer selects `amp`, `antigravity`, `codex`, `gsd`, `zed`, and `agents`
- **THEN** the CLI installs and reports one shared loader plus only the selected Antigravity workflow wrapper, with no Codex custom prompt or legacy-root installation

<!-- focused-spec:id=init.install.no-runtime-setup -->
#### Scenario: Installation does not imply executable integration
- **WHEN** init succeeds in a project with no focused-spec evidence setup
- **THEN** only selected integration files are written; no native specification, configuration, registry, runner, dependency, global settings, or `AGENTS.md` is changed, and success identifies installation rather than evidence readiness or execution

### Requirement: Deliberate target selection
Init SHALL accept only explicitly selected catalog targets, deduplicate aliases and destinations, and reject invalid arguments before writes. Without `--tools`, only eligible TTY use MAY open the searchable multi-select picker; scripts and JSON require `--tools` and bypass it. Detected directories SHALL remain unselected, global MiniMax SHALL be marked before confirmation, and cancellation SHALL leave both roots unchanged.

<!-- focused-spec:id=init.selection.explicit -->
#### Scenario: Noninteractive initialization cannot infer authorization
- **WHEN** init runs without `--tools` through noninteractive input or JSON mode, including a project with detected agent directories
- **THEN** it exits nonzero with actionable selection guidance and does not modify the project

<!-- focused-spec:id=init.selection.interactive -->
#### Scenario: Interactive confirmation determines installed targets
- **WHEN** an interactive user searches and explicitly selects targets, proceeds through review, or cancels after seeing suggested integrations
- **THEN** only the nonempty selection confirmed after review is installed, or cancellation exits nonzero without writes
- **AND** merely detected targets and an unselected global MiniMax never become authorized by cursor placement or a default

<!-- focused-spec:id=init.selection.invalid -->
#### Scenario: Invalid selections and arguments are rejected
- **WHEN** a user supplies an empty or unsupported target, unknown option, missing value, or extra positional argument
- **THEN** init exits nonzero with an actionable diagnostic before any directory or file is created

### Requirement: Interactive installation has a bounded focus presentation
Interactive init SHALL show an eight-row golden `f` with a skippable 2200 ms blur-to-sharp reveal beside installation guidance in scrollback, never in an alternate screen or after clearing the display. Enter opens a separate searchable picker without another logo. `--no-animation` and reduced capabilities retain a legible static glyph and controls. Scripted init and other commands never show it or imply evidence success.

<!-- focused-spec:id=init.welcome.inline -->
#### Scenario: Welcome explains setup before choosing agents
- **WHEN** a user starts eligible interactive init in a terminal
- **THEN** a small animated or static logo appears beside meaningful installation guidance in normal scrollback without clearing the entire display or opening the alternate screen
- **AND** Enter moves to a distinct searchable picker without another logo, before any project or home file is written

<!-- focused-spec:id=init.focus.silhouette -->
#### Scenario: Picker focus resolves to the approved block form
- **WHEN** an interactive user opens init in a terminal supporting color and motion
- **THEN** its reveal becomes progressively sharper, settles on the eight-row square lowercase `f` with a one-block stem, a three-block top ledge and a three-block crossbar extending on both sides of the stem, and does not add curls or a separate diamond
- **AND** skipping the reveal immediately shows the same sharp glyph without waiting

<!-- focused-spec:id=init.focus.fallback -->
#### Scenario: Reduced terminal capabilities retain usable selection
- **WHEN** animation is disabled, color is unavailable, or the terminal is narrow
- **THEN** init shows a static, non-color-dependent glyph and usable selection controls without delaying installation review

<!-- focused-spec:id=init.focus.isolation -->
#### Scenario: Scripted initialization and ordinary commands never animate
- **WHEN** a user invokes init with explicit `--tools` on a terminal, requests JSON output, or runs another CLI command
- **THEN** no interactive installer screen or focus animation appears, and those commands retain their existing results

### Requirement: Interactive installation restores the terminal
Interactive init SHALL restore the cursor, input mode and screen on exit, error and interruption. Cancelling before confirmation SHALL leave project and home unchanged and SHALL not report successful installation.

<!-- focused-spec:id=init.session.restore -->
#### Scenario: Cancel or interruption returns the shell to normal
- **WHEN** a user cancels the picker, declines review, or interrupts init during its reveal or before confirmation
- **THEN** the terminal returns to normal input and display state without any installation writes or false success

### Requirement: Inspect planned integration before confirmation
Interactive init SHALL show exact selected destinations and their install, unchanged, replace or conflict actions before any non-preview write confirmation. Project and global paths SHALL be distinct. Review SHALL reuse ordinary root, asset and destination checks; conflicts block writes without explicit replacement. Dry-run, decline and cancellation SHALL leave both project and home untouched.

<!-- focused-spec:id=init.review.prewrite -->
#### Scenario: Mixed project and home setup requires informed consent
- **WHEN** the picker selects a project-local target and global MiniMax while one selected destination differs from the bundled asset
- **THEN** review identifies both destinations, the home location and the conflict before any writes; declining, cancelling, or lacking explicit replacement leaves both roots unchanged

<!-- focused-spec:id=init.review.preview -->
#### Scenario: Dry-run review performs no installation
- **WHEN** an interactive selection uses `--dry-run` and reaches action review
- **THEN** the terminal displays the checked plan without writing project or home files, and the existing preview exit/result semantics remain authoritative

### Requirement: Safe reinitialization
Init SHALL plan unique selected destinations across both roots before writes. Missing files SHALL install; identical files SHALL stay untouched. Divergent regular files SHALL conflict unless `--replace` authorizes selected-file replacement. Any known conflict SHALL block all writes in both roots. Unselected targets/neighbors SHALL be preserved; destination state SHALL be rechecked before writing without clobbering concurrent changes.

<!-- focused-spec:id=init.reinit.unchanged -->
#### Scenario: Identical integration is a no-op
- **WHEN** init is repeated for targets whose installed integration bytes already match the package assets
- **THEN** it succeeds, reports unchanged files, and leaves those files untouched

<!-- focused-spec:id=init.reinit.conflict -->
#### Scenario: Customized integration blocks all planned writes
- **WHEN** one selected destination has custom content and another selected destination is missing, without `--replace`
- **THEN** init reports the conflict and exits nonzero while preserving the custom file and not installing the otherwise missing integration

<!-- focused-spec:id=init.reinit.replace -->
#### Scenario: Replacement is restricted to selected integration files
- **WHEN** a consumer explicitly reinitializes with `--replace`
- **THEN** divergent selected regular files are replaced with bundled assets while unselected integrations and custom neighboring files remain unchanged

### Requirement: Side-effect-free preview
`--dry-run` SHALL execute the same argument, asset, project/home-root, destination and conflict checks as installation but SHALL create or modify no directory or file in either root. `--replace --dry-run` SHALL preview replacement rather than perform it. Conflicts SHALL remain nonzero failures.

<!-- focused-spec:id=init.preview.no-writes -->
#### Scenario: Preview preserves the full filesystem
- **WHEN** a consumer previews missing integrations, conflicting custom content, or explicitly authorized replacements
- **THEN** the reported actions and exit status reflect the corresponding installation plan while every existing file and directory remains unchanged and no new directory is created

### Requirement: Installation boundary validation
Init SHALL use canonical existing selected project/home roots, never infer or create roots. It SHALL reject escapes, symlinked components, non-directory ancestors and non-regular destinations before writes, even with replacement. Root symlinks MAY resolve canonically. Missing/unreadable/empty assets SHALL fail without fallback/download. Later I/O failure need not roll back completed writes but SHALL report them honestly.

<!-- focused-spec:id=init.boundary.unsafe-destination -->
#### Scenario: Unsafe destination cannot redirect installation
- **WHEN** a selected destination or ancestor is a symlink, non-directory ancestor, or non-regular destination, including with `--replace`
- **THEN** init fails before installation and leaves the selected and referenced outside trees unchanged

<!-- focused-spec:id=init.boundary.invalid-root -->
#### Scenario: Invalid project root is not created
- **WHEN** init names a missing or non-directory root
- **THEN** it exits nonzero without creating a project or searching for another root

<!-- focused-spec:id=init.assets.unavailable -->
#### Scenario: Incomplete package cannot partially install integration
- **WHEN** a required selected-target loader or wrapper asset is unavailable, unreadable, or empty
- **THEN** init fails before any integration writes and does not substitute content from another installation or network source

### Requirement: Observable initialization result
Init SHALL exit 0 for successful install/no-op/preview, otherwise 1. Human output SHALL distinguish installation from activation/evidence and give native hints. JSON SHALL emit one `{ root, tools, dryRun, files, errors }` object: canonical project root or null, distinct canonical tools, preview flag, project-relative or absolute MiniMax paths, truthful actions/errors. Only completed writes SHALL be applied, retained after later failure.

<!-- focused-spec:id=init.output.json -->
#### Scenario: Machine-readable output distinguishes writes and conflicts
- **WHEN** a scripted consumer installs, previews, or encounters a destination conflict using `--json` and explicit targets
- **THEN** stdout contains one parseable result document with the actual actions, applied writes and errors, and the exit status distinguishes success from failure without claiming evidence execution
- **AND** files use `{ path, action, applied }`, actions are `install`, `unchanged`, `replace` or `conflict`, and errors use `{ path?, message }`; only completed writes have `applied: true`

### Requirement: Complete target catalog
The installer SHALL support the following complete OpenSpec 1.14.1 target set at these fixed focused-spec destinations, without a runtime dependency on OpenSpec. `~` denotes the canonical existing user home; other paths are relative to the selected project. A missing command entry denotes skills-only delivery.

<!-- focused-spec:id=init.targets.catalog -->
#### Scenario: Every canonical target installs its own integration offline
- **WHEN** a packed offline consumer selects each canonical target in an isolated existing project and home
- **THEN** every target installs only its declared loader and native wrapper destinations with no guessed legacy or unselected integration

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

### Requirement: Host-native entrypoint delivery
Wrappers SHALL use the host-readable format, focused-spec identity and native task arguments to request the skill, without embedded workflow or extra permissions. Hints SHALL distinguish native command/prompt, explicit skill and natural-language invocation. They SHALL explain Hermes external-directory setup without editing config and limit Copilot prompt claims to IDEs.

<!-- focused-spec:id=init.targets.native-formats -->
#### Scenario: Native wrappers preserve the supplied task
- **WHEN** a consumer installs command-capable targets and invokes or parses their native wrapper with a task
- **THEN** the host-readable wrapper requests the focused-spec skill with that task, using the correct command identity and native arguments without OpenSpec permissions or workflow duplication
- **AND** Markdown, TOML, `.prompt` and `.prompt.md` wrappers are valid for their hosts; hints explain the appropriate invocation and required external setup without claiming unsupported CLI/cloud activation

<!-- focused-spec:id=init.targets.alias -->
#### Scenario: Windsurf selects canonical Devin integration
- **WHEN** a consumer selects `windsurf`, including alongside `devin`
- **THEN** the installer reports canonical `devin`, writes each Devin destination once, and leaves `.windsurf` and unrelated files untouched

### Requirement: Explicit global MiniMax integration
Only explicit `minimax-code` selection SHALL install `~/.minimax/skills/focused-spec/SKILL.md`, with no project MiniMax directory, global command, settings or dependency. The loader SHALL resolve guidance from the consuming project. Project-only selections SHALL not require or mutate home integration. Conflict, preview, replacement, safety and reporting guarantees SHALL cover both roots.

<!-- focused-spec:id=init.global.minimax -->
#### Scenario: MiniMax uses its actual home skill root
- **WHEN** a consumer explicitly selects MiniMax with an isolated home and consuming project
- **THEN** only its home loader is installed, without project `.minimax` or `.mavis`, host config edits, or a global package; project-only selections leave home integration untouched

<!-- focused-spec:id=init.global.preview -->
#### Scenario: Mixed preview is write-free in both roots
- **WHEN** a consumer previews mixed project and MiniMax installation or authorized replacement
- **THEN** the actions describe the actual plan and both complete directory/file trees remain unchanged

<!-- focused-spec:id=init.global.conflict -->
#### Scenario: A conflict in either root prevents all planned writes
- **WHEN** one selected project or MiniMax integration contains custom content while another selected destination in the other root is missing
- **THEN** init exits nonzero and preserves both trees without installing the otherwise missing integration

<!-- focused-spec:id=init.global.replace -->
#### Scenario: Global replacement remains narrowly authorized
- **WHEN** a consumer selects MiniMax and explicitly uses `--replace`
- **THEN** only its divergent home loader is replaced while neighboring home files and unselected project integrations remain untouched

<!-- focused-spec:id=init.global.unsafe -->
#### Scenario: Unsafe home destination cannot redirect writes
- **WHEN** the selected MiniMax home root is unavailable or a destination component is symlinked, non-directory, or non-regular, including with replacement
- **THEN** init fails before project or home writes and preserves both roots and any referenced outside tree

<!-- focused-spec:id=init.global.reporting -->
#### Scenario: JSON identifies actual global writes
- **WHEN** a consumer installs, previews, or conflicts on selected MiniMax integration using JSON
- **THEN** the envelope retains its canonical project root, global file/error paths name the canonical absolute home destination, and actions/applied flags/errors/exit status identify actual completed or blocked writes
