# CLI reference

The binary is `focused-spec`. During agent-led BDD or SDD work, the agent loads the installed skill when its description applies—including SDK-only executable-scenario and application-driver work without a host framework—and selects one installed CLI for guidance: an explicit path when supplied, otherwise a compatible project/workspace installation when present, otherwise PATH/global. The user need not call either separately. That agent-tooling prerequisite does not make the CLI an SDK runtime dependency or require evidence configuration for native execution. Shell examples here use a project-pinned package and `npx focused-spec` for optional manual/CI operation; the loader invokes its selected executable directly.

## Commands

```text
focused-spec version [--json]
focused-spec --version
focused-spec -V
focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--strict] [--syntax-only] [--json] [--timings]
focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--details] [--json] [--timings]
focused-spec list [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--json]
focused-spec show <id> [--root <path>] [--config <path>] [--scope <name>] [--json]
focused-spec plugin-docs (--format <id> | --runner <id> | --package <specifier>) [--root <path>] [--config <path>] [--json]
focused-spec instructions [--protocol <version>] [--topic workflow|review|author-revise|upgrade|verify|integration|formats|runners] [--json]
focused-spec init [path] [--tools <comma-separated IDs>] [--dry-run] [--json] [--replace] [--no-animation]
```

Scope names are path-safe single fragments. The CLI preserves the selected name exactly; it never treats it as a glob or path.

## Executable version identity

`version`, `--version`, and `-V` identify the invoked `focused-spec` installation without reading project configuration, importing plugins, accessing the network, or writing files. They read the package manifest beside the invoked core distribution rather than resolving another package from the consumer project. Text output is exactly `focused-spec <version>`.

`focused-spec version --json` writes exactly this shape to stdout:

```json
{
  "package": { "name": "focused-spec", "version": "<installed version>" },
  "executable": "<canonical absolute path to the invoked core dist/cli.js>",
  "runtime": { "node": "<Node.js version>" },
  "contracts": { "guidance": 1, "configuration": 5, "format": 2, "runner": 1 }
}
```

`--json` is available only on the `version` command. Unsupported, duplicate, or extra version arguments fail rather than being ignored.

## Help and error transport

Use `focused-spec --help`, `<command> --help`, and `focused-spec help <command>` for the installed command's options, defaults, selection rules, and examples. Explicit help exits zero without reading project configuration, documents, format-owned evidence sources, plugins, or guidance assets. `version`, `list`, `show`, `validate`, and `plugin-docs` help likewise work before project setup. For a known command, help takes precedence over other options, including `--json`. The retired `transition` command and its help forms are unknown commands, not aliases.

`validate --help` distinguishes syntax-only, non-strict, and strict behavior and documents scenario selection. `list` and `show` help distinguish structural enrollment inspection from evidence resolution, test execution, and native coverage. `run --help` explains strict preflight, scope/scenario isolation, AND execution, skip policy, and result context. Validation and execution help distinguish focused evidence from host-format validity and unenrolled native history.

No command, an unknown command or option, an extra positional argument, a duplicate option, a missing value, or an unknown `help` target exits nonzero with the relevant help pointer. Repeated value and boolean options are rejected even if their values agree or a later value is valid. For example, neither `run --scope first --scope second` nor `instructions --protocol 2 --protocol 1` uses the last value. Explicit help on a known command still takes precedence and performs no project work.

With an actual `--json` option, invalid invocations exit 1 with empty stdout and exactly one stderr object:

```ts
{ error: { code: 'invalid_arguments', message: '<diagnostic>', help: 'focused-spec [command] --help' } }
```

An uncaught command failure uses the same empty-stdout, single-object stderr transport without inventing a business result:

```ts
{ error: { code: 'command_failed', message: '<actionable cause>' } }
```

The CLI recognizes transport options at their actual argument boundaries. A consumed scenario value such as `--scenario --json`, or a show ID after the positional delimiter in `show -- --json`, remains the exact opaque value and does not enable JSON transport. Conversely, a rejected flag-looking ordinary option value does not hide a later actual `--json` option.

These envelopes are only for invalid invocation and uncaught failures. Command-specific validation, inspection, execution, initialization, plugin-documentation, and guidance results retain their documented stdout shapes. Human mode retains its diagnostic and pasteable help pointer; JSON mode renders a thrown error only once.

## Installed plugin documentation

`plugin-docs` returns the complete Markdown document owned by exactly one selected installed plugin, with provenance. Select a configured registration with `--format <id>` or `--runner <id>`; these forms load configuration from `--root` and optional `--config`. Select an installed package or public subpath independently with `--package <specifier>`; that form resolves from the selected consumer root and never reads project configuration, so `--config` is invalid with it. Exactly one selector is required.

```sh
npx focused-spec plugin-docs --format <id> --json
npx focused-spec plugin-docs --runner <id> --root ../consumer --config config/focused.yaml --json
npx focused-spec plugin-docs --package <specifier> --root ../consumer --json
```

Package lookup uses consumer-local ESM import conditions, finds the owning installed package manifest even when `package.json` is not exported, and never imports the plugin entry. The package manifest must contain nonempty `name` and `version`. Its document defaults to package-root `README.md`; optional manifest `focusedSpec.documentation` selects a relative `.md` or `.markdown` file. An explicit malformed, missing, unsafe, or unreadable declaration fails without falling back to README or another document. Packages need no metadata change when their public contract is already in root `README.md`.

For a package whose public contract is separate from its README, its own `package.json` may contain:

```json
{ "focusedSpec": { "documentation": "docs/plugin.md" } }
```

A configured project module may declare `documentation: <project-relative Markdown file>` beside `module`. `documentation` is allowed only for module registrations; package documentation remains package-owned and cannot be overridden in project configuration. Missing module documentation makes that registration unavailable to `plugin-docs` but does not affect validation or execution of the plugin itself.

Documentation paths must be nonempty relative Markdown paths without absolute/drive forms, backslashes, traversal, or NULs. The canonical regular file must remain within its canonical package or project root after symlink resolution and contain nonempty strict UTF-8. The CLI reads bytes without executing or interpreting Markdown; it preserves the complete content and authored links, whose base is the returned document path.

JSON output is exactly:

```ts
{
  selection: { kind: 'format' | 'runner' | 'package', name: '<requested value>' },
  plugin:
    | { package: '<specifier>', name: '<manifest name>', version: '<manifest version>', root: '<canonical absolute package root>' }
    | { module: '<configured path>', root: '<canonical absolute project root>' },
  document: { path: '<canonical absolute document path>', content: '<complete Markdown>' }
}
```

Text output identifies the requested selection, package name/version or configured module, owning root, and document path before the complete Markdown. Documentation is dependency or project text with visible provenance, not a core-owned contract. Successful lookup does not assert compatibility.

The command never enumerates packages, scans opaque plugin options, imports plugin code, downloads dependencies, writes project or agent files, validates evidence, or aggregates nested documents. A composing plugin documents its own nested configuration. After reading it, request a named nested package explicitly with a subsequent `plugin-docs --package <specifier> --root <path> --json` call.

Unavailable packages, registrations or documents; invalid configuration required by registration lookup; malformed metadata; and unsafe paths exit 1 with actionable stderr and empty stdout. Unknown, duplicate, missing or conflicting options additionally include a `plugin-docs --help` pointer. Help succeeds without project setup and takes precedence over other options.

## Agent initialization

`init` copies package-owned integration into the canonical explicitly named existing project directory, or cwd. Only explicit `minimax-code` selection additionally authorizes its global home skill. It does not search for an ancestor, download skills, install dependencies, load evidence configuration, or depend on OpenSpec. The fixed catalog below is audited against published OpenSpec 1.14.1: 50 canonical targets, 34 native wrappers, 16 skills-only targets. `~` denotes the existing canonical home root; all other paths are project-relative.

| ID | Loader destination | Native wrapper destination |
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

`--tools` trims comma-separated IDs and deduplicates IDs and shared destinations. Empty/unknown IDs, missing values, duplicate/unknown options, and extra paths fail before writing. There are no `all` or `none` aliases. Omitting `--tools` opens a compact welcome in ordinary terminal scrollback only with TTY input/output, without `--json` or CI. Press Enter to move from the animated logo and installation summary to a separate picker. There, type to search target IDs, use arrows to move, Space to toggle, Backspace to edit the filter, Enter to review, then Y to authorize writes separately. Detected directories are unselected suggestions. Esc clears a nonempty filter, then cancels; Ctrl-C or EOF cancels immediately. Empty selection cannot proceed. Explicit `--tools` bypasses all interactive screens even on a terminal.

`windsurf` normalizes to `devin` before deduplication/reporting and writes only `.devin`; existing `.windsurf` content is untouched. Amp, Antigravity, Codex, GSD, Zed and agents share one identical `.agents/skills` loader. Antigravity additionally receives its workflow; Codex gets no `.codex` prompt. The interactive picker labels MiniMax as global-only. On selection, the picker collapses; a compact review groups exact canonical home and project paths under plain-language headings for new, already present, replacement and conflicting files, with muted paths rather than uppercase action codes. Scroll to the end of a longer review before confirming; conflicts block writes unless `--replace` was explicitly passed. After confirmation, the review collapses to a concise setup result and native agent entrypoints rather than repeating every file action. The scripted path retains its detailed per-file action output.

The interactive installer alone reveals the eight-row golden `f` beside a short explanation over 2.2 seconds. Any key skips the reveal, but Enter is still needed to enter selection; `--no-animation` shows the final glyph immediately. No alternate terminal screen or whole-display clear is used. The logo does not repeat in the picker. `NO_COLOR`, `TERM=dumb`, reduced motion and narrow terminals show a usable static fallback; installer status never implies evidence success. Cancel, error and interruption restore terminal input and cursor. Other commands and explicit `--tools` never show this welcome.

MiniMax installs only `~/.minimax/skills/focused-spec/SKILL.md`, never a project `.minimax`/`.mavis`, settings, commands or global package. Home resolution/inspection occurs only when it is selected. Missing or non-directory home roots fail without creating a home. The global loader uses the same installed-CLI selection policy as every other loader; it does not require a project-local installation.

All selected assets and destinations across both canonical roots are checked before any mutation. Missing files are installed; byte-identical files are unchanged. Any divergent selected file in either root blocks all writes in both unless `--replace` explicitly authorizes replacement. Extras and unselected targets are preserved. Missing/non-directory roots, symlinked components below either root, non-directory ancestors and non-regular destinations fail even with `--replace`. A symlink naming a root itself resolves to its canonical directory. Missing, unreadable or empty selected assets fail without fallback. Destination state is rechecked before writing; this is not an atomic transaction or a sandbox against hostile races.

`--dry-run` performs the same checks without creating or modifying files; interactive mode shows the checked review but has no write confirmation. `--replace --dry-run` previews replacement, and conflicts still exit 1. Successful install/no-op/preview exits 0; failures and cancellation exit 1. Later I/O failures may leave completed or partially written files: results retain completed writes, with the failed path in `errors`; no rollback is promised.

Human output distinguishes installation from evidence readiness, skill loading and execution. The installed skill's description requires the agent to load it for matching specification workflows even without an explicit user invocation; installation alone does not certify that a host complies. Printed invocation hints describe optional direct entrypoints or troubleshooting: native command-file hosts generally use `/focused-spec <task>`; Amazon Q uses `@focused-spec`, Codex `$focused-spec`, Kimi `/skill:focused-spec`, and Continue its prompt selector. Devin workflows apply to Desktop; Local uses the skill. Skills-only/universal hosts expose their native skill mechanism. Hermes needs the project’s `.hermes/skills` directory in `skills.external_dirs`; init prints the hint but never edits configuration. Copilot prompt files target IDEs, not Copilot CLI/cloud setup. Host routing and permissions remain authoritative; init does not certify the loader’s later local-CLI resolution.

After a valid invocation, `--json` emits one installation-result document on stdout with no progress prose. Installation conflicts and I/O failures remain business results in this shape; JSON mode omits redundant plaintext stderr:

```json
{
  "root": "/canonical/project",
  "tools": ["codex"],
  "dryRun": true,
  "files": [{ "path": ".agents/skills/focused-spec/SKILL.md", "action": "install", "applied": false }],
  "errors": []
}
```

`root` is the canonical project root, or null if its resolution fails; `tools` contains normalized distinct canonical IDs. Project file/error paths are project-relative; MiniMax file/error paths are canonical absolute home paths (an unavailable home is reported using its requested absolute destination). Actions are `install`, `unchanged`, `replace`, or `conflict`. `applied` is true only for completed writes, never unchanged/previewed files, and remains truthful after later I/O failures. Errors are `{ "path"?: "<destination>", "message": "<diagnostic>" }`; unsafe destinations may lack a file action. Help stays human-readable with `--json` and does not probe project/home integrations.

Argument parsing and required noninteractive target selection happen before installation starts. Invalid options, duplicate options, extra paths, or a JSON/noninteractive/CI invocation without `--tools` are invocation failures: they exit 1 with empty stdout and perform no integration write. In JSON mode, stderr is the shared `invalid_arguments` object pointing to `focused-spec init --help`; human mode prints the diagnostic and help pointer. They are not installation reports. Once invocation is valid, installation failures continue to return the stdout report above, including truthful completed writes and errors.

```sh
npx focused-spec init --no-animation
npx focused-spec init --tools oh-my-pi,claude
npx focused-spec init ../project --tools codex --dry-run --json
npx focused-spec init --tools claude --replace
npx focused-spec init --tools minimax-code --dry-run --json
```

## Package-owned agent guidance

`instructions` reads authoritative guidance from the invoked `focused-spec` package. The default `workflow` topic is a compact router; focused operation topics are `review`, `author-revise`, `upgrade`, and `verify`. Shared topics provide composition selection (`integration`), format obligations (`formats`), and runner obligations (`runners`). Integration is available from core alone before optional packages or configuration exist. Its compact nonexclusive capability map is orientation, not a plugin manual, allowlist or host compatibility matrix. Exact syntax and selectors come from selected installed plugin documents resolved from an explicit project root. All topics work offline, create no files, and perform no project validation or evidence execution. Invoke one selected installed CLI and keep it for the workflow step; it may be project-local, global, or explicitly located.

The previous `agent-guide` command is not an alias. Refresh an installed loader when moving to `instructions`. Protocol 1 and its response fields remain unchanged as focused topics are added.

For example, from a project-pinned installation:

```sh
./node_modules/.bin/focused-spec instructions --protocol 1 --topic integration --json
```

The workflow routes each operation to its focused topic, absent or explicitly reconsidered integration to `integration`, and incompatible setups to `upgrade`. Guidance retrieval does not authorize installation, configuration or migration.

The `integration` topic also carries the pinned .NET SDK `0.10.1` GitHub Release installation procedure: public artifact URL, SHA-256, project-local NuGet feed, preserved custom sources/mapping, and repeatable CI restore. The procedure is served offline without a checkout; performing the download and installation requires network access and authorization. It does not claim nuget.org publication or add a .NET CLI runner. See the human-facing [installation guide](../guides/install.md#net-sdk-from-github-releases).

Loader protocol defaults to 1; it is independent of package versions, configuration version 5, Format API version 2, and Runner API version 1. The loader requests it explicitly. Protocol-1 JSON is:

```json
{
  "protocolVersion": 1,
  "package": { "name": "focused-spec", "version": "<installed version>" },
  "topic": "workflow",
  "content": "<complete Markdown guidance>"
}
```

The response's `topic` is exactly the requested `workflow`, `review`, `author-revise`, `upgrade`, `verify`, `integration`, `formats`, or `runners`; the default remains `workflow`. Every topic ships with core, independently of whether adapter packages are installed. The thin loader selects the executable and obtains the compact router. That router acquires the operation/shared topic from the same executable, then separately acquires each selected plugin's document against the explicit project root through [`plugin-docs`](#installed-plugin-documentation).

Acquire each response with a standalone tool command. Even an executable check such as `test -x … && <CLI> instructions …` is a combined call; perform checks separately. Do not chain guidance with `init --json`, installation, help or another request. If this happens, request guidance again by itself; extracting one object from combined output is not accepted acquisition. A host truncation notice leaves acquisition unfinished until a completed read of that successful command's exact linked full-output artifact delivers the complete protocol response. Hidden metadata, a clipped preview, another call's artifact, or extracted `content` alone is insufficient. The CLI-owned workflow router owns this response handling once; the thin loader does not duplicate it.

Text output identifies the installed package version, protocol, and topic before the Markdown. An unsupported protocol, invalid option/topic, missing value, or incomplete package exits nonzero with stderr diagnostics and no usable guidance on stdout. An explicit unsupported protocol is never silently replaced with the default. No legacy full-text skill or alternate installation is used as a fallback.

```sh
npx --no-install focused-spec instructions --protocol 1 --json
npx --no-install focused-spec instructions --protocol 1 --topic author-revise --json
npx --no-install focused-spec instructions --protocol 1 --topic verify --json
```

## Validation

Validation reads version-5 configuration and documents selected by explicit layouts. Every layout names a registered API-2 format adapter; core does not infer one from a path or extension. The selected formats supply normalized item identity and evidence directly or through optional whole-catalog binding. Core does not load or default an evidence registry. Missing evidence, detached or duplicate identities, conflicting or forged enrollments, overlapping source claims, malformed adapter results, and adapter lifecycle failures are violations.

`validate --syntax-only` checks configuration, adapter parsing/binding, normalized references, scope-local identity, and source structure without loading runner plugins. Full `validate` additionally loads runners and resolves concrete evidence, but never executes tests. A successful full-validation JSON result retains:

```json
{
  "valid": true,
  "validationScope": {
    "scopes": { "mode": "selected", "name": "add-search" },
    "scenario": "search.results.empty"
  },
  "scenarios": 1,
  "plannedEvidence": 0,
  "targets": 1
}
```

- `scenarios` is the number of normalized enrollments in the validation selection;
- `plannedEvidence` is the number of selected `planned:` references;
- `targets` is the number of unique resolved executable targets. Planned evidence is not resolved and does not contribute.

Unmarked native content is not focused coverage and is not reported as an arbitrary native-item count. Validation failures return `valid: false`, the actual `validationScope`, and machine-readable `violations`; successful counts are omitted.

Non-strict validation permits planned evidence and skips its resolution. `--strict` rejects it. Syntax-only validation does not load runners; non-strict and strict full validation may load runners and resolve the references selected by their mode, but never execute tests. `--strict` and `--syntax-only` are validate-only; `--allow-skip` is run-only.

Without `--scope`, validation selects every discovered scope; with `--scope <name>`, it selects only that scope. Adding `--scenario <id>` narrows either selection to the exact scope-local occurrences with that opaque ID, using the same selection boundary as `run --scenario`: without an explicit scope every matching same-ID occurrence is independently selected, while an explicit scope isolates the matching occurrence there. Unrelated entry, binding, and evidence failures do not block the selected scenario. The reported `validationScope` always includes the actual scope mode and, when selected, the exact scenario ID.

Removing `--scenario` restores full selected-scope validation. A missing requested scope or scenario is an error. Structural source/parse failures still block because the format could not reliably produce its contract. An all-scope project with no discovered documents, enrollments, or structural source failures is valid and reports zero counts; an adapter-specific missing external source is an error only when that selected adapter requires it.

## Enrollment inspection

`list` inventories format-provided enrollments; `show <id>` looks up one exact opaque ID. Both use `--root <path>` and optional `--config <path>` explicitly, load the selected Format API 2 adapters, parse/bind their documents and evidence sources, and validate normalized structure with planned evidence permitted. They may execute trusted format code. They never load runner plugins, resolve executable targets, execute evidence, scan packages, interpret opaque plugin options, write project files, or claim `PASS`, host-format validity, or coverage of unenrolled native content.

`list` accepts optional `--scope <name>` and `--scenario <id>` selectors. `show` takes exactly one positional ID and optional `--scope <name>`; use `focused-spec show -- <id>` when an opaque ID begins with `-`, with all options before `--`. IDs retain exact case, Unicode, spaces, and punctuation. Without `--scope`, `show` returns every independently enrolled occurrence with the exact ID across scopes; with it, only that scope can match. Missing, duplicate, unknown, or excess arguments fail rather than selecting or normalizing another value.

Successful `--json` output is exactly this shape:

```ts
{
  valid: true,
  selection: {
    scopes: { mode: 'all' } | { mode: 'selected', name: '<scope>' },
    scenario?: '<exact opaque ID>'
  },
  scenarios: [{
    scope: '<scope>',
    id: '<exact opaque ID>',
    name: '<native scenario name>',
    source: { path: '<native source path>', line: 1 },
    evidence: [{
      reference: '<exact ordered evidence reference>',
      source: { path: '<evidence source path>', line: 1 }
    }]
  }]
}
```

Rows sort by raw scope and then raw ID, without case folding or locale normalization. References remain in supplied order. Each evidence source uses that reference's `evidenceLocations[index]` when present, otherwise the shared `evidenceLocation`, otherwise the native scenario source. These paths and lines are format-provided provenance; inspection reports them without opening the returned paths merely for display. Text mode exposes the same selection, enrollment, reference, and provenance information and never labels it `PASS`.

Configuration failures, missing selected scopes or IDs, malformed selected references, duplicate enrollments, and required structural source failures exit 1 with no usable partial inventory:

```ts
{
  valid: false,
  selection: {
    scopes: { mode: 'all' } | { mode: 'selected', name: '<scope>' },
    scenario?: '<exact opaque ID>'
  },
  violations: [/* machine-readable validation violations */]
}
```

Failed inspection omits `scenarios`. An empty all-scope project is a valid empty inventory. Explicit selection isolates unrelated semantic failures, but not failures required to read or structurally interpret the selected sources. Unexpected thrown failures use the shared CLI error transport instead of this business-result shape.

## Execution and result context

`run` performs strict validation before executing anything:

- without `--scope`, binding, resolution, and execution select all scopes;
- with `--scope <name>`, they select only that scope;
- `run --scenario <id>` selects only matching `(scope, ID)` entries, including their native bindings and evidence. Unrelated entry, binding, and evidence failures do not prevent that selected run.

With no `--scope`, a repeated ID selects each matching scope independently and uses each entry's evidence. Shared resolved targets remain deduplicated; same-ID reuse does not merge scenario results or inherit evidence. Validation and execution use the same scenario-selection boundary, but validation never executes tests.

Text output begins with validation and execution context lines such as:

```text
validation scope: all discovered scopes
execution selection: all discovered scopes
```

or:

```text
validation scope: selected scope add-search, scenario search.results.empty
execution selection: selected scope add-search, scenario search.results.empty
```

Completed JSON retains `executionStarted`, `validationScope`, `executionSelection`, `success`, the `scenarios` result array, and `targetCount`. Both context objects use `scopes: { "mode": "all" }` for all-scope execution or `scopes: { "mode": "selected", "name": "<scope>" }` for one scope. When `--scenario` is present, both also contain that scenario ID.

Every scenario result includes its `scope`, native `name` and `source: { path, line }`. Native provenance comes from the selected item, not a target's display name, test location or evidence registry. Text shows that name/source beneath its identity. Multi-scope text rows include `[<scope>]`; selected-scope rows omit that prefix. No execution output includes an unverified native-item count.

Each evidence result retains its exact `reference`, actual `status`, optional `diagnostic` and optional ordered `events` from that target's [execution report](runner-api.md#execution-events). Shared targets execute once and their events appear under each citing evidence reference; separate target streams are never merged into a scenario-wide log. Legacy runners that omit events remain unchanged.

`run --details` renders retained events beneath every evidence result. Compact human output renders only non-PASS evidence events; JSON always contains all supplied retained events, including passing evidence, independently of this flag. `run --details --json` is valid and returns the same JSON contract as `run --json`. Rendering never changes collection, selection, target count or status and does not rerun targets. Every producer-defined kind uses the same `[kind] message` presentation followed by JSON `data` when supplied; there are no specialized observation/explanation renderers. Human-rendered kinds, messages and data escape terminal control characters; JSON preserves their real values through JSON encoding. Events can contain sensitive application data and are not automatically redacted.

Human execution, validation, inspection and command-error output applies the same escaping to opaque identities, names, paths, references and diagnostics: terminal control characters, Unicode format characters and Unicode line/paragraph separators appear as `\uXXXX` text rather than acting on the terminal. Diagnostic newlines may remain as host-indented lines. This is presentation-only; JSON values and selectors delivered to runners are unchanged. Instruction and plugin-document bodies remain intentional document output.

```sh
./node_modules/.bin/focused-spec run --root examples/scenarios/typescript --scenario account.withdraw.insufficient-funds --details
./node_modules/.bin/focused-spec run --root examples/scenarios/go --scenario account.withdraw.insufficient-funds --details --json
```

`--details` is run-only. It does not bypass strict preflight: a rejected run has no synthetic execution events or native execution rows. Help, validation and inspection remain non-executing.

If configuration, format parsing or binding, selected evidence resolution, or strict validation fails before execution, text says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, actual selection context, and `violations`, and omits execution result fields. A scenario ID absent from the selected scope or scopes follows this failure contract. Scope-wide validation is not implied by a successful scenario-only run.

`--allow-skip` applies only to `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed. Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`; only `PASS` succeeds by default. The CLI exits nonzero on invalid configuration, discovery, format enrollment, unresolved evidence, failed execution, errors, or disallowed skips.

## Timing output

`--timings` opts into operation telemetry as well as phase timing. Without the flag, JSON has no `timings` property and text has no timing lines. With it, JSON uses this output shape (shown in TypeScript notation; these are CLI result types, not plugin APIs or package exports):

```ts
type TimingOutcome = 'completed' | 'error'

type RunnerOperationTiming = {
  readonly startedMs: number
  readonly durationMs: number
  readonly outcome: TimingOutcome
  readonly runnerId: string
} & (
  | { readonly operation: 'resolve'; readonly selectorCount: number }
  | { readonly operation: 'partition' | 'run'; readonly targetCount: number }
)

interface FormatOperationTiming {
  readonly startedMs: number
  readonly durationMs: number
  readonly outcome: TimingOutcome
  readonly formatId: string
  readonly path: string
  readonly scope: string
  readonly coldStart: boolean
}

interface Timings {
  readonly validationMs?: number
  readonly resolutionMs?: number
  readonly executionMs?: number
  readonly totalMs: number
  readonly runnerOperations: readonly RunnerOperationTiming[]
  readonly formatOperations: readonly FormatOperationTiming[]
}
```

All timing values are finite, nonnegative milliseconds of elapsed wall time. `startedMs` is an offset from the command's monotonic timing origin; `durationMs` measures the operation interval. The existing phase fields retain their meanings: `validationMs` covers document discovery, parsing, format-owned evidence acquisition and catalog binding; `resolutionMs` covers runner resolution; `executionMs` covers execution and scheduling; and `totalMs` covers the command until output construction begins. A phase appears only when reached.

Each runner row represents one actual core-facing invocation. A `resolve` row's `selectorCount` is the number of unique selectors passed to that invocation, not the number of scenario references. A `partition` or `run` row's `targetCount` is the number of input targets passed to that invocation, not every test in the project. Partition rows appear only when partitioning is invoked, and each admitted execution group has its own run row; time waiting for scheduler admission is excluded from the run interval.

Each format row represents one entered document `parse` call and identifies its configured format, normalized project-relative document path, and scope. The first actual request to a newly created format client/host has `coldStart: true`; later requests through that client have `coldStart: false`. Its duration covers the whole core-facing parse call, including host startup when applicable, lazy module initialization, IPC, parsing, response validation, and normalization. It excludes document reading and later catalog `bind` work, which remains part of validation without fabricating a document timing row. A failure before the parse call, such as a source-read failure, produces no format row.

`outcome: 'completed'` means the plugin returned a valid response. Native diagnostics, missing selectors, and test `FAIL` or `SKIP` results are therefore completed operations; their normal violations and statuses remain authoritative. Thrown errors, malformed responses, timeouts, and host crashes use `outcome: 'error'`. Failed output retains rows for calls that started and omits calls that were never reached; it never fabricates later work.

When timing collection is enabled, both arrays are present even when empty. Ordinary `validate` may report format parses and runner resolution, but never partition or run rows. `validate --syntax-only` reports entered format parses but no runner rows. `run` may report format parses, resolution, an actually invoked partition operation, and each actual run invocation. Unknown format configuration or another failure before parsing can leave both arrays empty.

Arrays are ordered by `startedMs`, with deterministic identity tie-breakers. Concurrent intervals can overlap, so operation durations and phase values are not additive: summing them does not produce command wall time. Use offsets to understand overlap and phase totals or `totalMs` for elapsed command time.

The following values are illustrative and nonmeasured:

```json
{
  "timings": {
    "validationMs": 18,
    "resolutionMs": 9,
    "executionMs": 24,
    "totalMs": 53,
    "runnerOperations": [
      { "runnerId": "vitest", "operation": "resolve", "selectorCount": 3, "startedMs": 19, "durationMs": 8, "outcome": "completed" },
      { "runnerId": "vitest", "operation": "partition", "targetCount": 3, "startedMs": 28, "durationMs": 1, "outcome": "completed" },
      { "runnerId": "vitest", "operation": "run", "targetCount": 2, "startedMs": 30, "durationMs": 20, "outcome": "completed" },
      { "runnerId": "vitest", "operation": "run", "targetCount": 1, "startedMs": 31, "durationMs": 12, "outcome": "completed" }
    ],
    "formatOperations": [
      { "formatId": "markdown", "path": "specs/auth.md", "scope": "current", "coldStart": true, "startedMs": 2, "durationMs": 10, "outcome": "completed" },
      { "formatId": "markdown", "path": "specs/access.md", "scope": "current", "coldStart": false, "startedMs": 13, "durationMs": 3, "outcome": "completed" }
    ]
  }
}
```

Equivalent illustrative, nonmeasured text detail is appended below the existing phase line:

```text
timings: validation 18.00 ms, resolution 9.00 ms, execution 24.00 ms, total 53.00 ms
  runner vitest resolve: 8.00 ms, start 19.00 ms, selectors 3, completed
  runner vitest partition: 1.00 ms, start 28.00 ms, targets 3, completed
  runner vitest run: 20.00 ms, start 30.00 ms, targets 2, completed
  runner vitest run: 12.00 ms, start 31.00 ms, targets 1, completed
  format markdown [current] specs/auth.md: 10.00 ms, start 2.00 ms, cold-start, completed
  format markdown [current] specs/access.md: 3.00 ms, start 13.00 ms, reused-host, completed
```

## Execution concurrency

`execution.maxConcurrentGroups` is a positive integer and defaults to 1. Above 1, core overlaps only resource-compatible groups returned by a runner's optional `partition` method. Runners without partition support and explicitly exclusive groups remain exclusive. This setting does not configure framework worker counts or coordinate other CLI processes. See the [runner API](runner-api.md).

## Configuration and migration

The default config is `.focused-spec/config.yaml` under `--root`; a relative `--config` path resolves from that root. Configuration requires `version: 5`, a nonempty `specifications.formats` ID map, a nonempty `specifications.documents` list, and a `runners` map. Every document layout names one configured Format API 2 adapter. Formats and runners each declare exactly one installed `package` or project-contained `module`, plus JSON-compatible options and bounded timeouts; runners may additionally declare `cwd`. Package/subpath resolution uses ESM import conditions from the consuming project and never a global or downloaded fallback. Core rejects top-level `evidence`; inline and external storage are selected through format packages and opaque format options.

Versions 1–4 and Format API 1 have no compatibility alias. Unsupported `REVISES` and inline ID/EVIDENCE selected through a non-inline format also fail. Diagnostics identify how to load the `upgrade` topic from the selected executable; for a project-pinned npm installation, a human can use `npx --no-install focused-spec instructions --protocol 1 --topic upgrade --json`. The workflow is served without loading obsolete configuration and has no project-root option. A supported historical inline project may select the API-2 inline adapter and keep its ID/EVIDENCE rows while removing `REVISES`; external evidence moves into explicit registry-adapter options. The [configuration guide](../guides/configuration.md#migrate-older-configurations) preserves the full migration rules.
