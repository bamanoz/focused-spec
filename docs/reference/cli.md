# CLI reference

The binary is `focused-spec`.

## Commands

```text
focused-spec validate [--root <path>] [--config <path>] [--scope <name>] [--strict] [--syntax-only] [--json] [--timings]
focused-spec run [--root <path>] [--config <path>] [--scope <name>] [--scenario <id>] [--allow-skip] [--json] [--timings]
focused-spec instructions [--protocol <version>] [--topic workflow|runners] [--json]
focused-spec init [path] [--tools <comma-separated IDs>] [--dry-run] [--json] [--replace]
```

Scope names are path-safe single fragments. The CLI preserves the selected name exactly; it never treats it as a glob or path.

## Help and argument errors

Use `focused-spec --help`, `<command> --help`, and `focused-spec help <command>` for the installed command's options, defaults, selection rules, and examples. Explicit help exits zero without reading project configuration, the evidence registry, plugins, or guidance assets. For a known command, help takes precedence over other options, including `--json`. The retired `transition` command and its help forms are unknown commands, not aliases.

No command, an unknown command or option, an extra positional argument, a duplicate option, a missing value, or an unknown `help` target exits nonzero with a diagnostic and the relevant help pointer.

Repeated value and boolean options are rejected even if their values agree or a later value is valid. For example, neither `run --scope first --scope second` nor `instructions --protocol 2 --protocol 1` uses the last value. Explicit help on a known command still takes precedence and performs no project work.

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

`--tools` trims comma-separated IDs and deduplicates IDs and shared destinations. Empty/unknown IDs, missing values, duplicate/unknown options, and extra paths fail before writing. There are no `all` or `none` aliases. Omitting `--tools` prompts only when stdin and stdout are terminals and `--json` is absent. Existing directories suggest choices; only a nonempty confirmed selection authorizes installation. Empty input, Ctrl-C, and EOF cancel with exit 1 and no writes.

`windsurf` normalizes to `devin` before deduplication/reporting and writes only `.devin`; existing `.windsurf` content is untouched. Amp, Antigravity, Codex, GSD, Zed and agents share one identical `.agents/skills` loader. Antigravity additionally receives its workflow; Codex gets no `.codex` prompt. Interactive choices identify MiniMax as a global home destination before confirmation.

MiniMax installs only `~/.minimax/skills/focused-spec/SKILL.md`, never a project `.minimax`/`.mavis`, settings, commands or global package. Home resolution/inspection occurs only when it is selected. Missing or non-directory home roots fail without creating a home. The global loader still resolves the consuming project’s local CLI, not a global installation.

All selected assets and destinations across both canonical roots are checked before any mutation. Missing files are installed; byte-identical files are unchanged. Any divergent selected file in either root blocks all writes in both unless `--replace` explicitly authorizes replacement. Extras and unselected targets are preserved. Missing/non-directory roots, symlinked components below either root, non-directory ancestors and non-regular destinations fail even with `--replace`. A symlink naming a root itself resolves to its canonical directory. Missing, unreadable or empty selected assets fail without fallback. Destination state is rechecked before writing; this is not an atomic transaction or a sandbox against hostile races.

`--dry-run` performs the same checks without creating or modifying files; `--replace --dry-run` previews replacement, and conflicts still exit 1. Successful install/no-op/preview exits 0; failures and cancellation exit 1. Later I/O failures may leave completed or partially written files: results retain completed writes, with the failed path in `errors`; no rollback is promised.

Human output distinguishes installation from evidence readiness, skill activation and execution. Native command-file hosts generally use `/focused-spec <task>`; Amazon Q uses `@focused-spec`, Codex `$focused-spec`, Kimi `/skill:focused-spec`, and Continue its prompt selector. Devin workflows apply to Desktop; Local uses the skill. Skills-only/universal hosts use their native skill invocation or a natural-language request. Hermes needs the project’s `.hermes/skills` directory in `skills.external_dirs`; init prints the hint but never edits configuration. Copilot prompt files target IDEs, not Copilot CLI/cloud setup. Host routing and permissions remain authoritative; init does not certify the loader’s later local-CLI resolution.

`--json` emits one stdout document with no progress prose, plus stderr diagnostics on failure:

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

```sh
focused-spec init --tools oh-my-pi,claude
focused-spec init ../project --tools codex --dry-run --json
focused-spec init --tools claude --replace
focused-spec init --tools minimax-code --dry-run --json
```

## Package-owned agent guidance

`instructions` reads the invoked package's authoritative workflow (default topic) or complete runner guidance (`--topic runners`). It works offline before project setup, creates no project or agent files, and does not perform validation or evidence execution. Invoke the consuming project's explicit installed CLI, not an unverified global binary or a downloading `npx` invocation.

The previous `agent-guide` command is not an alias. Refresh the installed loader when moving to `instructions`; protocol 1, topic names and response fields are unchanged.

Loader protocol defaults to 1; it is independent of package versions, configuration version 4, and format/runner API version 1. The loader requests it explicitly. Protocol-1 JSON is:

```json
{
  "protocolVersion": 1,
  "package": { "name": "focused-spec", "version": "<installed version>" },
  "topic": "workflow",
  "content": "<complete Markdown guidance>"
}
```

Acquire each response with a standalone tool command. Do not chain it with `init --json`, installation, help or another guidance request: combined stdout is not the single protocol object. If this happens, request guidance again by itself; extracting one object from concatenated output is not accepted acquisition.

Text output identifies the installed package version, protocol, and topic before the Markdown. An unsupported protocol, invalid option/topic, missing value, or incomplete package exits nonzero with stderr diagnostics and no usable guidance on stdout. An explicit unsupported protocol is never silently replaced with the default. No legacy full-text skill or alternate installation is used as a fallback.

```sh
focused-spec instructions --protocol 1 --json
focused-spec instructions --protocol 1 --topic runners --json
```

## Validation

Validation reads version-4 configuration, its configured evidence-registry files (default `.focused-spec/evidence.yaml`), and documents selected by explicit layouts. Every layout names a registered format adapter; core does not infer one from the path or extension. Validation binds every selected registry entry to exactly one normalized native item and rejects marked items without entries. Missing, detached, duplicate, conflicting, unbound, ambiguous, malformed-adapter, or adapter-lifecycle results are violations.

`validate --syntax-only` checks configuration, registry syntax, adapter parsing, scope-local identity, and binding without loading runner plugins. Full `validate` additionally loads runners and resolves concrete evidence, but never executes tests. A successful full-validation JSON result retains:

```json
{
  "valid": true,
  "validationScope": {
    "scopes": { "mode": "all" }
  },
  "scenarios": 1,
  "plannedEvidence": 1,
  "targets": 0
}
```

- `scenarios` is the number of bound registry entries in the validation selection;
- `plannedEvidence` is the number of selected `planned:` references;
- `targets` is the number of unique resolved executable targets. Planned evidence is not resolved and does not contribute.

Unmarked native content is not focused coverage and is not reported as an arbitrary native-item count. Validation failures return `valid: false`, the actual `validationScope`, and machine-readable `violations`; successful counts are omitted.

Non-strict validation permits planned evidence and skips its resolution. `--strict` rejects it. Use syntax-only or non-strict validation while planning, and strict validation after every selected target exists.

Without `--scope`, validation selects every discovered scope and registry entry. With `--scope <name>`, it selects only that scope and ignores failures elsewhere. A missing selected scope is an error. An all-scope project with a present registry containing `scopes: {}` and no discovered documents is valid and reports zero counts; a missing registry is always an error.

## Execution and result context

`run` performs strict validation before executing anything:

- without `--scope`, binding, resolution, and execution select all scopes;
- with `--scope <name>`, they select only that scope;
- `run --scenario <id>` selects only matching `(scope, ID)` entries, including their native bindings and evidence. Unrelated entry, binding, and evidence failures do not prevent that selected run.

With no `--scope`, a repeated ID selects each matching scope independently and uses each entry's evidence. Shared resolved targets remain deduplicated; same-ID reuse does not merge scenario results or inherit evidence. Plain `validate`, including `validate --strict`, still checks its complete selected scope set and never executes tests.

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

Every scenario result includes its `scope`. Multi-scope text rows include `[<scope>]`; selected-scope rows omit that prefix. No execution output includes an unverified native-item count.

If configuration, registry parsing, native binding, selected evidence resolution, or strict validation fails before execution, text says `execution did not start`. JSON reports `valid: false`, `executionStarted: false`, actual selection context, and `violations`, and omits execution result fields. A scenario ID absent from the selected scope or scopes follows this failure contract. Scope-wide validation is not implied by a successful scenario-only run.

`--allow-skip` applies only to `run`. It permits a skipped scenario to produce a successful process exit without relabelling it as passed. Scenario and target statuses are `PASS`, `FAIL`, `SKIP`, and `ERROR`; only `PASS` succeeds by default. The CLI exits nonzero on invalid configuration, missing or invalid registry, discovery or binding violations, unresolved evidence, failed execution, errors, or disallowed skips.

## Timing output

`--timings` adds a `timings` object to JSON or a `timings:` line to text. `validationMs` covers registry loading, document discovery, parsing, and binding; `resolutionMs` covers runner resolution; `executionMs` covers execution and scheduling; `totalMs` covers the command until output construction begins. A phase appears only when reached. Concurrent activities may overlap, so phase values are not additive.

## Execution concurrency

`execution.maxConcurrentGroups` is a positive integer and defaults to 1. Above 1, core overlaps only resource-compatible groups returned by a runner's optional `partition` method. Runners without partition support and explicitly exclusive groups remain exclusive. This setting does not configure framework worker counts or coordinate other CLI processes. See the [runner API](runner-api.md).

## Configuration and migration

The default config is `.focused-spec/config.yaml` under `--root`; a relative `--config` path resolves from that root. Configuration requires `version: 4`, a nonempty `specifications.formats` ID map, a nonempty `specifications.documents` list, and a `runners` map. Every document layout names one configured format. Formats and runners each declare exactly one installed `package` or project-contained `module`, plus JSON-compatible options and bounded timeouts; runners may additionally declare `cwd`. Package/subpath resolution uses ESM import conditions from the consuming project and never a global or downloaded fallback. Optional `evidence.files` selects explicit project-relative YAML paths or patterns. Omission uses `.focused-spec/evidence.yaml`; explicit sources never fall back to it. Registry paths resolve from `--root`, not the configuration file's directory. Missing matches, overlapping file claims, unsafe paths, and selected cross-file identity duplicates fail. See the [configuration and registry contract](../guides/configuration.md).

Versions 2 and 3 have no compatibility alias. Obsolete configuration and inline ID/EVIDENCE/REVISES diagnostics advertise `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json` from the installation root; use the platform-appropriate local executable or explicit installed Node CLI in a hoisted workspace. That command serves the package-owned upgrade workflow without loading obsolete configuration. Version 3 migration explicitly installs/registers selected formats and assigns one to every existing layout while preserving scopes, exclusions, registry sources and evidence. Version 2 additionally migrates inline native identity/evidence before the same version-4 format cutover. The [configuration guide](../guides/configuration.md#migrate-older-configurations) owns both migration references; the [installation guide](../guides/install.md) distinguishes an explicitly authorized update from ordinary fail-closed guidance acquisition. Runner plugins remain on `apiVersion: 1`.
