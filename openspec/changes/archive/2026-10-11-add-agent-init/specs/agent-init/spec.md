## ADDED Requirements

### Requirement: Explicit bundled project-local installation
The CLI SHALL provide `focused-spec init [path] [--tools <comma-separated IDs>] [--dry-run] [--json] [--replace]`. It SHALL install assets from the invoked package without downloading skills, reading repository implementation, or loading evidence configuration. It SHALL copy the bundled thin loader for the selected targets: `oh-my-pi` at `.omp/skills/focused-spec/SKILL.md`, `claude` at `.claude/skills/focused-spec/SKILL.md`, and `codex` or `agents` at `.agents/skills/focused-spec/SKILL.md`. Oh My Pi and Claude SHALL additionally receive a minimal skill-loading wrapper at their `.omp/commands/focused-spec.md` and `.claude/commands/focused-spec.md` respectively; Codex/shared targets SHALL remain skills-only. Wrappers SHALL NOT duplicate authoritative workflow content.

<!-- focused-spec:id=init.install.selected-targets -->
#### Scenario: Selected integrations install offline
- **WHEN** a consumer invokes the packed installed CLI with explicit Oh My Pi and Claude targets in an existing project without network or source-checkout access
- **THEN** the selected loaders and skill-loading wrappers are installed from that package, with no unselected agent integration or remote download

<!-- focused-spec:id=init.install.shared-root -->
#### Scenario: Codex and shared targets have one destination
- **WHEN** a consumer selects both `codex` and `agents`
- **THEN** the CLI installs and reports one shared loader destination without generating a global or project-local custom prompt

<!-- focused-spec:id=init.install.no-runtime-setup -->
#### Scenario: Installation does not imply executable integration
- **WHEN** init succeeds in a project with no focused-spec evidence setup
- **THEN** no native specification, configuration, registry, runner, dependency installation, global settings, or `AGENTS.md` is created or modified, and success identifies agent installation rather than evidence readiness or executed evidence

### Requirement: Deliberate target selection
Init SHALL support exactly `oh-my-pi`, `claude`, `codex`, and `agents`, trim comma-separated IDs, and deduplicate repeated IDs. It SHALL reject empty selections, empty IDs, unknown IDs/options, missing values, and extra positional arguments before mutation. Without `--tools`, only a TTY invocation not using `--json` MAY prompt for targets; existing agent directories SHALL suggest choices without authorizing them. Noninteractive and JSON invocations SHALL require explicit targets. Interactive cancellation SHALL exit nonzero without writes.

<!-- focused-spec:id=init.selection.explicit -->
#### Scenario: Noninteractive initialization cannot infer authorization
- **WHEN** init runs without `--tools` through noninteractive input or JSON mode, including a project with detected agent directories
- **THEN** it exits nonzero with actionable selection guidance and does not modify the project

<!-- focused-spec:id=init.selection.interactive -->
#### Scenario: Interactive confirmation determines installed targets
- **WHEN** an interactive user selects targets or cancels after seeing suggested integrations
- **THEN** only the confirmed nonempty selection is installed, or cancellation exits nonzero without writes

<!-- focused-spec:id=init.selection.invalid -->
#### Scenario: Invalid selections and arguments are rejected
- **WHEN** a user supplies an empty or unsupported target, unknown option, missing value, or extra positional argument
- **THEN** init exits nonzero with an actionable diagnostic before any directory or file is created

### Requirement: Safe reinitialization
Init SHALL plan all unique selected destinations before mutation. Missing files SHALL be installable; identical files SHALL remain untouched. Divergent regular files SHALL be conflicts unless `--replace` explicitly authorizes replacement of the selected integration files. Any known conflict SHALL abort all planned writes. Init SHALL preserve unselected targets and neighboring files and SHALL recheck destination state before writing rather than silently clobber concurrently changed content.

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
`--dry-run` SHALL execute the same argument, asset, root, destination, and conflict checks as installation but SHALL create or modify no directory or file. `--replace --dry-run` SHALL preview replacement rather than perform it. Conflicts SHALL remain nonzero failures in preview mode.

<!-- focused-spec:id=init.preview.no-writes -->
#### Scenario: Preview preserves the full filesystem
- **WHEN** a consumer previews missing integrations, conflicting custom content, or explicitly authorized replacements
- **THEN** the reported actions and exit status reflect the corresponding installation plan while every existing file and directory remains unchanged and no new directory is created

### Requirement: Installation boundary validation
Init SHALL target the canonical explicitly named existing directory or cwd, never an inferred ancestor. It SHALL reject unavailable/non-directory roots, symlinked destination components beneath the canonical root, non-directory ancestors, non-regular destination files, and project-root escapes before mutation. `--replace` SHALL NOT bypass those restrictions. Missing, unreadable, or empty required package assets SHALL fail preflight rather than trigger fallback instructions or downloads. Preflight SHALL NOT imply transactional rollback under arbitrary later I/O failure; completed writes SHALL be reported honestly.

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
Init SHALL exit 0 only for a successful installation/no-op/preview and 1 for failure or cancellation. Human output SHALL distinguish installation from evidence execution and give target-appropriate invocation hints. `--json` SHALL return one document `{ root, tools, dryRun, files, errors }` with no progress prose: canonical root or null, normalized distinct target IDs, preview flag, file entries `{ path, action, applied }`, and error entries `{ path?, message }`. File paths SHALL be project-relative, actions SHALL be `install`, `unchanged`, `replace`, or `conflict`, and `applied` SHALL identify only completed writes. Preview and unchanged entries SHALL NOT claim writes. Failure after a completed write SHALL preserve its applied status in the report.

<!-- focused-spec:id=init.output.json -->
#### Scenario: Machine-readable output distinguishes writes and conflicts
- **WHEN** a scripted consumer installs, previews, or encounters a destination conflict using `--json` and explicit targets
- **THEN** stdout contains one parseable result document with the actual actions, applied writes and errors, and the exit status distinguishes success from failure without claiming evidence execution
