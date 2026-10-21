# Install

Want your coding agent to handle setup? Give it the [agent installation guide](agent-install.md). It follows the local installation contracts below and hands off to the installed skill.

## CLI

In a consuming Node.js 22.16.0+ project, install the format-neutral CLI as a development dependency using the project's existing package manager. For npm:

```sh
npm install --save-dev focused-spec
```

For agent-led composition selection, the agent loads the installed skill and follows its local workflow; the user does not need to invoke focused-spec separately. First integration or an explicitly reconsidered composition uses the same CLI's on-demand `integration` topic before optional packages are selected; selected installed contracts then govern configuration. The examples below illustrate choices, not another agent selection procedure. Installation-only work leaves configuration/evidence pending.

These are independent installations. Core alone has no Markdown/Gherkin parser, inline dialect, registry loader, or test-framework runner. An inline project may install only `format-inline`; an external-evidence project installs `format-registry` plus the native parser it names. Omit packages the project does not configure. Test frameworks remain consumer-owned prerequisites. Adapter installation never selects a format or evidence source implicitly; [version-5 configuration](configuration.md) must register each package and name one format on every document layout.

For example, a standalone inline Markdown project with existing Vitest tests needs only:

```sh
npm install --save-dev @focused-spec/format-inline @focused-spec/runner-vitest
```

For native Markdown with external YAML evidence, choose `@focused-spec/format-registry` and `@focused-spec/format-markdown` instead of the inline adapter; Gherkin uses `@focused-spec/format-gherkin` as its native parser. Choose `@focused-spec/runner-go` or `@focused-spec/runner-pytest` only for evidence that uses those frameworks. The [configuration guide](configuration.md#public-format-contracts) maps the format contracts; the [runner guide](runners.md) owns framework requirements and selector syntax.

For executable JS/TS scenarios without focused-spec, install only `@focused-spec/scenarios-typescript`; it has no runtime dependencies or focused-spec peer. For optional native discovery and direct execution, add `focused-spec`, `@focused-spec/format-scenarios-typescript` and `@focused-spec/runner-scenarios-typescript`. The format owns the TypeScript AST parser dependency; neither SDK nor core gains it. The [SDK contract](../../packages/sdk/typescript/README.md), [format contract](../../packages/formats/scenarios-typescript/README.md) and [bank example](configuration.md#standalone-executable-bank-specifications) document both paths.

For independent Go scenarios, use the standard-library-only [Go SDK module](../../packages/sdk/go/README.md) with Go 1.23+; no Node.js or npm installation is needed. Install the coordinated release with `go get github.com/bamanoz/focused-spec/packages/sdk/go@v0.10.1` inside a Go module. Checkout examples retain an explicit local module replacement to exercise repository source. Optional focused-spec integration additionally installs `focused-spec`, `@focused-spec/format-scenarios-go` and `@focused-spec/runner-scenarios-go` as npm development dependencies. Their consumer needs both Node.js 22.16.0+ and Go 1.23+ on PATH. The Go parser helper ships inside the format package; core gains no Go dependency. Read its [format contract](../../packages/formats/scenarios-go/README.md) and [runner contract](runners.md#direct-go-scenarios) before configuration.

The executable is installed locally with the package. During agent-led specification work, the agent resolves and invokes that local installation; users do not need to run CLI commands themselves. For optional manual or CI use after configuring native documents and format-owned evidence, invoke `npx focused-spec validate` from the project root or use `focused-spec` in npm scripts. Run the shell examples here only after installing the project dependency, so npx selects that installation. Public types are exported from `focused-spec/format` and `focused-spec/runner`. Package installation does not install an agent skill, configure formats, or create evidence integration.

Read an installed plugin's public contract through the same project-local CLI without importing it: `npx focused-spec plugin-docs --format <id> --json` or `--runner <id>` for a configured registration, and `--package <specifier> --root <path> --json` for an installed package before configuration. Package lookup defaults to root `README.md` unless manifest `focusedSpec.documentation` selects another Markdown file. This lookup does not download, install, configure, validate, execute, or write anything; see the [CLI contract](../reference/cli.md#installed-plugin-documentation).

For development against a source checkout, bootstrap and build the private workspace first, then install the desired workspace package directories from the consuming project:

```sh
# /path/to/focused-spec
npm ci
npm run build

# consuming project
npm install --save-dev /path/to/focused-spec/packages/core \
  /path/to/focused-spec/packages/formats/inline \
  /path/to/focused-spec/packages/formats/registry \
  /path/to/focused-spec/packages/formats/markdown \
  /path/to/focused-spec/packages/runners/vitest
```

The workspace root is not a published package. Packages are grouped by role: `packages/core`, `packages/sdk/<language>`, `packages/formats/<format>` and `packages/runners/<runner>`. All thirteen npm packages—core, the JS/TS SDK, six formats and five runners—pack independently. The Go SDK is a separate Go module, not an npm workspace. Build core and the JS/TS SDK before their scenario format/runner, and the Go format before its runner; install local tarballs together when verifying a clean consumer. Core source/output live at `packages/core/src` and `packages/core/dist`; root `src`/`dist` are obsolete. The core tarball contains compiled CLI/types plus staged root `README.md`, `LICENSE`, `skills/` and `guidance/`; every other npm package owns its compiled runtime, declarations, metadata and README.

Official runner tarballs also include a public `README.md`, generated from the [runner guide](runners.md). It documents selector syntax, framework support and command options without requiring plugin implementation inspection.

Node.js 22.16 and 22.17 need the experimental type-stripping flag to load project-relative `.ts`/`.mts` plugins; the CLI supplies that flag to isolated plugin processes automatically. Keep TypeScript plugins erasable and use `import type`; JavaScript plugins need no flag.

Repository verification additionally uses Python 3.11+ (`tomllib`) to parse installed native TOML wrappers and Python's standard-library PTY for POSIX terminal checks. These are development-check prerequisites, not CLI/installer runtime dependencies; Windows terminal interaction remains uncertified.

## .NET SDK from GitHub Releases

The independent `FocusedSpec.Scenarios` SDK requires .NET 9+. Version `0.10.1` is distributed as a public [GitHub Release asset](https://github.com/bamanoz/focused-spec/releases/download/v0.10.1/FocusedSpec.Scenarios.0.10.1.nupkg), **not on nuget.org**. No Microsoft account, GitHub login, Node.js, or focused-spec CLI is required to install it.

From your consuming project or solution root, download the exact package into a local feed (macOS/Linux):

```sh
mkdir -p .nuget/local-feed
curl --fail --location --output .nuget/local-feed/FocusedSpec.Scenarios.0.10.1.nupkg \
  https://github.com/bamanoz/focused-spec/releases/download/v0.10.1/FocusedSpec.Scenarios.0.10.1.nupkg
```

On Windows PowerShell, use:

```powershell
New-Item -ItemType Directory -Force .nuget/local-feed | Out-Null
Invoke-WebRequest -Uri 'https://github.com/bamanoz/focused-spec/releases/download/v0.10.1/FocusedSpec.Scenarios.0.10.1.nupkg' -OutFile '.nuget/local-feed/FocusedSpec.Scenarios.0.10.1.nupkg'
```

The package's SHA-256 is `4c0689d653dd2f2d28ea1ebe37f30ce31578dbc318efe9b6ecbcd60f4c5392a9`. Check it with `shasum -a 256 .nuget/local-feed/FocusedSpec.Scenarios.0.10.1.nupkg` on macOS, `sha256sum` on Linux, or `Get-FileHash -Algorithm SHA256 .nuget/local-feed/FocusedSpec.Scenarios.0.10.1.nupkg` in PowerShell. Stop if it differs.

Create `NuGet.Config` beside `.nuget/` for a new project:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="focused-spec-local" value=".nuget/local-feed" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
```

For an existing configuration, merge the local source into its `packageSources`; do not replace custom feeds or add `clear`. If package source mapping is enabled, map `FocusedSpec.Scenarios` to `focused-spec-local` there too. The feed path is relative to `NuGet.Config`, not the shell's current directory.

Add the pinned dependency from the directory containing your `.csproj` (or pass the project path explicitly):

```sh
dotnet add package FocusedSpec.Scenarios --version 0.10.1
dotnet restore
```

Keep `NuGet.Config` and the generated `PackageReference` in version control. On another machine or in CI, repeat the download into the configured local feed **before** `dotnet restore`; alternatively, commit the `.nupkg` if your repository permits vendored dependencies. A developer's global NuGet cache is not a distribution source. For an upgrade, download the matching versioned asset and update the package reference and checksum together. Do not use the GitHub download URL as a NuGet HTTP feed.

See the [SDK API and executable example](../../packages/sdk/dotnet/FocusedSpec.Scenarios/README.md). This delivery path does not imply publication on nuget.org; that remains pending separately.

For coding agents, the same pinned distribution procedure is bundled in the local CLI's `integration` topic (`instructions --protocol 1 --topic integration --json`); the agent first loads the installed skill and obtains its workflow. Use `focused-spec@0.10.1` or later for this procedure; older published npm versions are immutable and do not acquire guidance updates from this repository.

## Agent skill

Install the skill for the agent doing BDD or SDD work. Its [description](../../skills/focused-spec/SKILL.md) requires loading before reviewing, authoring, revising, or verifying executable scenarios or their application drivers, including SDK-only tasks without an SDD framework or CLI integration, and before SDD steps concerning behavioral requirements or scenarios. This applies across formats and commands, even without a request naming focused-spec. The agent loads the skill and calls the CLI; these are not additional user steps. It follows a host workflow when present and preserves read-only/planning limits. Installing the npm dependency alone does not install the skill; manual and CI CLI use remain optional.

The agent loader needs a compatible project-local CLI to obtain current guidance. Independent SDK execution does not: the native suite/test wrapper needs only its language SDK and runtime. Installing agent tooling does not authorize adding CLI plugins, focused configuration, registries, or Markdown companions to SDK-only work.

### Bundled agent integration

Use the CLI installed in the consuming project to copy its bundled loader and minimal command wrappers, without downloading skills.

For a human at a terminal, run `npx focused-spec init` after installing the local dependency. A small welcome appears in normal terminal scrollback: the animated `f` sits beside a bold greeting with a gold product name, a muted description, and a short list of the integration files this setup can install. The agent handles specification work after setup; the welcome does not prescribe manual next steps. Press Enter to open the separate agent picker; any other key skips the reveal but stays on the welcome. Search by typing, move with arrows, toggle targets with Space, and press Enter. The picker collapses to the selected agents and a compact checked setup review lists the exact paths and actions; scroll to the end if needed, then press Y separately to install. After writing, a short success confirmation identifies the installed integration, not evidence readiness.

Selected targets remain gold when the cursor moves away; the cursor highlight uses the same warm gold on brown, without a blue selection state.

Agents and scripts should pass explicit targets; the following examples bypass the interactive picker:

```sh
npx focused-spec init --tools oh-my-pi,claude
npx focused-spec init ../project --tools codex --dry-run --json
```

The optional path must name an existing directory; cwd is the default, with no ancestor discovery. The installer supports all 50 canonical targets from OpenSpec 1.14.1, plus alias `windsurf` → `devin`. See the [complete destination catalog](../reference/cli.md#agent-initialization): 34 targets receive native Markdown/TOML commands, prompt files or workflows; 16 receive only the loader. No OpenSpec installation or network access is required.

MiniMax Code is the sole **global-only** target: explicitly selecting `minimax-code` authorizes `~/.minimax/skills/focused-spec/SKILL.md`. Terminal selection labels this home destination before confirmation. It never writes a project `.minimax` or `.mavis`, host settings, commands or a global package. Other targets stay project-local and do not inspect home integration. Preview it before installing:

```sh
npx focused-spec init --tools minimax-code --dry-run --json
```

The global loader still resolves guidance from the consuming project’s local CLI. JSON keeps the project root and project-relative paths; MiniMax file/error paths are canonical absolute home paths.

Amp, Antigravity, Codex, GSD, Zed and `agents` share one `.agents/skills` loader; Antigravity also receives its workflow. The Windsurf alias writes only `.devin`, preserving existing `.windsurf` files. Other integrations are untouched. Without `--tools`, an eligible terminal opens the searchable picker and requires a nonempty selection plus separate confirmation after the checked action review. Esc, Ctrl-C or EOF cancels without writes. Scripts, CI and `--json` require explicit `--tools`; no `all`/`none` aliases exist.

Repeat initialization leaves identical files untouched. A divergent selected file in either project or home blocks all planned writes in both unless `--replace` explicitly authorizes replacing selected regular integration files. Neighbors/unselected targets are preserved. Unsafe roots, symlinked components, non-directory ancestors and non-regular destinations remain errors with replacement. `--dry-run` performs the same checks without writes; conflicts still fail. Later I/O errors can leave partial writes, reported honestly without promised rollback. See the [JSON and safety contract](../reference/cli.md#agent-initialization).

Success means installation only: init does not create native specifications, configuration, evidence registries, format/runner registrations, adapter dependencies, global settings, or `AGENTS.md`. It neither certifies agent activation nor executes evidence. npm installation remains side-effect-free; use init explicitly. The wrappers only request skill loading, not a second workflow. Host routing may choose the same-name skill directly, and host tool permissions still govern guidance commands.

Explicit invocation is optional, for direct requests or troubleshooting—not a prerequisite for the agent's required loading: `/focused-spec <task>` on native command hosts, `@focused-spec` in Amazon Q, `$focused-spec` in Codex, `/skill:focused-spec` in Kimi, or Continue’s prompt selector. Skills-only hosts expose their native skill mechanism. Hermes requires the project’s `.hermes/skills` in `skills.external_dirs`; init provides the hint, not a config edit. Copilot prompt files are IDE integrations, not CLI/cloud setup. Devin Desktop uses the workflow; Devin Local uses the skill.

### External skills installer

Alternatively, install the skill separately from GitHub:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

To check that the installer can discover the skill before installing it, run `npx --yes skills add bamanoz/focused-spec --list`; it should list `focused-spec`.

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.

Install for the **agent that authors the behavioral specifications**, not just whichever agents the installer detects. For example, add `--agent claude-code` when that is the working agent; install in the consuming project or use `--global` if it should apply across projects. In that project's directory, `npx --yes skills list --agent claude-code` should show `focused-spec`. Listing a skill in the GitHub source with `--list` checks its metadata, not whether it is installed for your agent.

### Skill discovery and troubleshooting

The installed `SKILL.md` is a thin loader, not a frozen copy of the workflow. Before each specification-workflow step it obtains current instructions from the consuming project's installed CLI using `instructions --protocol 1 --topic workflow --json`. The workflow owns plugin-independent procedure. Format selection/configuration/authoring/implementation requests the shared `--topic formats`; runner work requests shared `--topic runners` from that same installation. Those core topics contain no plugin catalog. The loader then makes a separate `plugin-docs --format <id>`, `--runner <id>`, or explicit `--package <specifier>` request for the selected installed contract, retaining provenance. Composition is sequential: read the composing document, then explicitly request any nested package it names. Guidance topics work offline without project configuration; registration documentation lookup reads configuration, while explicit package lookup does not.

Each guidance acquisition is a separate tool command, never combined with installation, initialization or another request. After an integration refresh, reacquire the complete workflow by itself from the replacement local CLI.

The host must discover the installed skill's description, and the agent must load it for the matching workflows without waiting for the user to name it. A file on disk alone does not prove discovery or loading; `MUST-LOAD` is an agent obligation, not a runtime hook that can force a host to comply. If loading does not occur, check the chosen target, host skill discovery, required external-directory settings, and session reload. Explicit invocation can help diagnose the problem but is not the normal user workflow. Init does not rewrite project agent rules; any additional project-level enforcement is a separate authorized change. The authoritative workflow keeps host proposal phases planning-only: intended evidence belongs in planning artifacts, while executable evidence/configuration/runner integration waits for authorized implementation. Completion requires real selected evidence execution, not guidance loading or native validation alone.

Only the current loader/CLI-owned guidance format is supported. Ordinary specification work stops on a missing, pre-command or incompatible local CLI instead of falling back to global/downloaded/stale instructions. An explicit request to update focused-spec is different: it includes the local package, already installed focused integration, fresh workflow acquisition, and required project-format migration. The package-owned [upgrade procedure](../../guidance/workflow.md#update-an-existing-project) is served by the installed CLI; for a human operator with that local package available, use `npx --no-install focused-spec instructions --protocol 1 --topic workflow --json`. It remains available when old project configuration is rejected. Installation/init do not convert evidence or silently overwrite custom instructions. Refresh the loader and reacquire guidance after updating.
