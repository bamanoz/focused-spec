# Install

## CLI

In a consuming Node.js 22.16.0+ project, install the CLI as a development dependency:

```sh
npm install --save-dev focused-spec
```

The executable is `node_modules/.bin/focused-spec`; use it from npm scripts or run `./node_modules/.bin/focused-spec validate` in the project root after [configuring native documents and evidence](configuration.md). The runner types are available from `focused-spec/runner`. Package installation does not install an agent skill or create a runner for the project's test framework.

For development against a local source checkout, install it from the consuming project:

```sh
npm install --save-dev /path/to/focused-spec
```

Installing from a Git checkout or packing for npm builds `dist/` automatically via the package's `prepare` script; the published tarball includes the built CLI and type declarations.

Node.js 22.16 and 22.17 need the experimental type-stripping flag to load project-local `.ts`/`.mts` runners; the CLI supplies that flag to its isolated runner process automatically. Write runner plugins using erasable TypeScript syntax and `import type`; JavaScript plugins need no flag.

Repository verification additionally uses Python 3.11+ (`tomllib`) to parse installed native TOML wrappers, and Python's standard-library PTY for POSIX terminal checks. These are development-check prerequisites, not CLI/installer runtime dependencies; Windows terminal interaction remains uncertified.

## Agent skill

The CLI can validate and run manually bound native items without an installed skill. For agent-led specification authoring and evidence verification, install the skill for the agent doing that work; npm installation alone does not activate it.

### Bundled agent integration

Use the CLI installed in the consuming project to copy its bundled loader and minimal command wrappers, without downloading skills:

```sh
./node_modules/.bin/focused-spec init --tools oh-my-pi,claude
./node_modules/.bin/focused-spec init ../project --tools codex --dry-run --json
```

The optional path must name an existing directory; cwd is the default, with no ancestor discovery. The installer supports all 50 canonical targets from OpenSpec 1.14.1, plus alias `windsurf` → `devin`. See the [complete destination catalog](../reference/cli.md#agent-initialization): 34 targets receive native Markdown/TOML commands, prompt files or workflows; 16 receive only the loader. No OpenSpec installation or network access is required.

MiniMax Code is the sole **global-only** target: explicitly selecting `minimax-code` authorizes `~/.minimax/skills/focused-spec/SKILL.md`. Terminal selection labels this home destination before confirmation. It never writes a project `.minimax` or `.mavis`, host settings, commands or a global package. Other targets stay project-local and do not inspect home integration. Preview it before installing:

```sh
./node_modules/.bin/focused-spec init --tools minimax-code --dry-run --json
```

The global loader still resolves guidance from the consuming project’s local CLI. JSON keeps the project root and project-relative paths; MiniMax file/error paths are canonical absolute home paths.

Amp, Antigravity, Codex, GSD, Zed and `agents` share one `.agents/skills` loader; Antigravity also receives its workflow. The Windsurf alias writes only `.devin`, preserving existing `.windsurf` files. Other integrations are untouched. Without `--tools`, terminal users must confirm a nonempty comma-separated selection; detected paths are suggestions, not permission. Empty input, Ctrl-C or EOF cancels without writes. Scripts and `--json` require explicit `--tools`; no `all`/`none` aliases exist.

Repeat initialization leaves identical files untouched. A divergent selected file in either project or home blocks all planned writes in both unless `--replace` explicitly authorizes replacing selected regular integration files. Neighbors/unselected targets are preserved. Unsafe roots, symlinked components, non-directory ancestors and non-regular destinations remain errors with replacement. `--dry-run` performs the same checks without writes; conflicts still fail. Later I/O errors can leave partial writes, reported honestly without promised rollback. See the [JSON and safety contract](../reference/cli.md#agent-initialization).

Success means installation only: init does not create native specifications, configuration, evidence registry, runners, dependencies, global settings, or `AGENTS.md`. It neither certifies agent activation nor executes evidence. npm installation remains side-effect-free; use init explicitly. The wrappers only request skill loading, not a second workflow. Host routing may choose the same-name skill directly, and host tool permissions still govern guidance commands.

Use `/focused-spec <task>` on native command hosts, `@focused-spec` in Amazon Q, `$focused-spec` in Codex, `/skill:focused-spec` in Kimi, or Continue’s prompt selector. Skills-only hosts use native skill invocation or a natural-language request. Hermes requires the project’s `.hermes/skills` in `skills.external_dirs`; init provides the hint, not a config edit. Copilot prompt files are IDE integrations, not CLI/cloud setup. Devin Desktop uses the workflow; Devin Local uses the skill.

### External skills installer

Alternatively, install the skill separately from GitHub:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

To check that the installer can discover the skill before installing it, run `npx --yes skills add bamanoz/focused-spec --list`; it should list `focused-spec`.

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.

Install for the **agent that authors the behavioral specifications**, not just whichever agents the installer detects. For example, add `--agent claude-code` when that is the working agent; install in the consuming project or use `--global` if it should apply across projects. In that project's directory, `npx --yes skills list --agent claude-code` should show `focused-spec`. Listing a skill in the GitHub source with `--list` checks its metadata, not whether it is installed for your agent.

The installed `SKILL.md` is a thin loader, not a frozen copy of the workflow. Before each specification-workflow step it obtains current instructions from the consuming project's installed CLI using `instructions --protocol 1 --topic workflow --json`. Runner work requests `--topic runners` from that same installation. Both topics ship with the CLI package and work offline without project configuration; the agent needs no source-checkout access. See the [guidance response contract](../reference/cli.md#package-owned-agent-guidance).

Installing the loader only makes it discoverable; the host agent must select and load it alongside its specification workflow skill. If a project must enforce this regardless of routing, put an explicit instruction in that project's agent instructions: “For any workflow that creates, changes, or publishes behavioral specifications, load the focused-spec skill alongside the host workflow skill; execute focused-spec evidence before completion.” An unread skill cannot enforce its own loading. The authoritative workflow keeps host proposal phases planning-only: intended evidence belongs in planning artifacts, while executable registry/configuration/runner integration waits for authorized implementation. Completion requires real selected evidence execution, not guidance delivery.

Only the current loader/CLI-owned guidance format is supported. Ordinary specification work stops on a missing, pre-command or incompatible local CLI instead of falling back to global/downloaded/stale instructions. An explicit request to update focused-spec is different: it includes the local package, already installed focused integration, fresh workflow acquisition, and required project-format migration. The package-owned [upgrade procedure](../../guidance/workflow.md#update-an-existing-project) is served by `./node_modules/.bin/focused-spec instructions --protocol 1 --topic workflow --json`; it remains available when old project configuration is rejected. Installation/init do not convert evidence or silently overwrite custom instructions. Refresh the loader and discard old full-text context before migrating; a fresh agent session also avoids stale authority.
