# Install

## CLI

In a consuming Node.js 22.16.0+ project, install the CLI as a development dependency:

```sh
npm install --save-dev focused-spec
```

The executable is `node_modules/.bin/focused-spec`; use it from npm scripts or run `./node_modules/.bin/focused-spec validate` in the project root after [configuring scenarios](configuration.md). The runner types are available from `focused-spec/runner`. Package installation does not install an agent skill or create a runner for the project's test framework.

For development against a local source checkout, install it from the consuming project:

```sh
npm install --save-dev /path/to/focused-spec
```

Installing from a Git checkout or packing for npm builds `dist/` automatically via the package's `prepare` script; the published tarball includes the built CLI and type declarations.

Node.js 22.16 and 22.17 need the experimental type-stripping flag to load project-local `.ts`/`.mts` runners; the CLI supplies that flag to its isolated runner process automatically. Write runner plugins using erasable TypeScript syntax and `import type`; JavaScript plugins need no flag.

## Agent skill

The CLI can validate and run manually authored scenarios without an installed skill. For agent-led scenario authoring and evidence verification, install the skill for the agent doing that work; npm installation alone does not activate it.

Install the skill separately from GitHub in the consuming project:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

To check that the installer can discover the skill before installing it, run `npx --yes skills add bamanoz/focused-spec --list`; it should list `focused-spec`.

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.

Install for the **agent that authors the behavioral specifications**, not just whichever agents the installer detects. For example, add `--agent claude-code` when that is the working agent; install in the consuming project or use `--global` if it should apply across projects. In that project's directory, `npx --yes skills list --agent claude-code` should show `focused-spec`. Listing a skill in the GitHub source with `--list` checks its metadata, not whether it is installed for your agent.

The installed skill includes a short `SKILL.md` and an on-demand `references/runners.md` workflow for writing and verifying project-local runners. An agent with only the installed skill and CLI does not need access to this repository's documentation or source. The runner reference is loaded only when runner work is needed.

Installing the skill only makes it discoverable; the host agent must select and load it alongside its specification workflow skill when authoring, revising, or publishing behavioral scenarios. If a project must enforce this regardless of agent skill routing, put an explicit instruction in that project's agent instructions: “For any workflow that creates, changes, or publishes behavioral scenarios, load the focused-spec skill alongside the host workflow skill; execute focused-spec evidence before completion.” A rule outside the skill is needed when the agent fails to load the skill at all; wording inside an unread `SKILL.md` cannot fix that. Once active, the skill requires a focused scenario for each independently failing new or changed outcome at planning time. Use a host-owned companion Markdown document when the native spec format cannot contain scenario blocks, and register that document through the host workflow. Planned evidence can remain until implementation; completion requires real selected tests to pass through `focused-spec run`.
