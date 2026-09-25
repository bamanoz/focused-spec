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

Install the skill separately from GitHub in the consuming project:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.

The installed skill includes a short `SKILL.md` and an on-demand `references/runners.md` workflow for writing and verifying project-local runners. An agent with only the installed skill and CLI does not need access to this repository's documentation or source. The runner reference is loaded only when runner work is needed.

Installing the skill only makes it discoverable; the host agent must load it during specification authoring and implementation. Once active, it requires a focused scenario for each independently failing behavioral outcome at planning time. Use a host-owned companion Markdown document when the native spec format cannot contain scenario blocks, and register that document through the host workflow. Planned evidence can remain until implementation; completion requires real selected tests to pass through `focused-spec run`.
