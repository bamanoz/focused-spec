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

## Agent skill

The CLI can validate and run manually bound native items without an installed skill. For agent-led specification authoring and evidence verification, install the skill for the agent doing that work; npm installation alone does not activate it.

Install the skill separately from GitHub in the consuming project:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

To check that the installer can discover the skill before installing it, run `npx --yes skills add bamanoz/focused-spec --list`; it should list `focused-spec`.

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.

Install for the **agent that authors the behavioral specifications**, not just whichever agents the installer detects. For example, add `--agent claude-code` when that is the working agent; install in the consuming project or use `--global` if it should apply across projects. In that project's directory, `npx --yes skills list --agent claude-code` should show `focused-spec`. Listing a skill in the GitHub source with `--list` checks its metadata, not whether it is installed for your agent.

The installed `SKILL.md` is a thin loader, not a frozen copy of the workflow. Before each specification-workflow step it obtains current instructions from the consuming project's installed CLI using `instructions --protocol 1 --topic workflow --json`. Runner work requests `--topic runners` from that same installation. Both topics ship with the CLI package and work offline without project configuration; the agent needs no source-checkout access. See the [guidance response contract](../reference/cli.md#package-owned-agent-guidance).

Installing the loader only makes it discoverable; the host agent must select and load it alongside its specification workflow skill. If a project must enforce this regardless of routing, put an explicit instruction in that project's agent instructions: “For any workflow that creates, changes, or publishes behavioral specifications, load the focused-spec skill alongside the host workflow skill; execute focused-spec evidence before completion.” An unread skill cannot enforce its own loading. The authoritative workflow keeps host proposal phases planning-only: intended evidence belongs in planning artifacts, while executable registry/configuration/runner integration waits for authorized implementation. Completion requires real selected evidence execution, not guidance delivery.

Only the new loader/CLI-owned guidance format is supported. A missing, pre-command, incompatible, or incomplete local CLI stops focused-spec work rather than falling back to a global binary, downloaded latest release, or legacy instructions. Project upgrades between workflow steps require fresh guidance; after replacing a legacy full-text skill, start a fresh agent session so old context does not drive the work. Existing projects are moved to the current format through separately requested agent changes, not automatic migration tooling. Installations do not silently overwrite custom instructions.
