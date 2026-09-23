# Install

## CLI

In a consuming Node.js 24+ project, install the CLI as a development dependency:

```sh
npm install --save-dev focused-spec
```

The executable is `node_modules/.bin/focused-spec`; use it from npm scripts or run `./node_modules/.bin/focused-spec validate` in the project root after [configuring scenarios](configuration.md). The runner types are available from `focused-spec/runner`. Package installation does not install an agent skill or create a runner for the project's test framework.

For development against a local source checkout, install it from the consuming project:

```sh
npm install --save-dev /path/to/focused-spec
```

Alternatively, `FOCUSED_SPEC_PACKAGE=/path/to/focused-spec /path/to/focused-spec/install.sh` performs that install. The script defaults to the npm package `focused-spec`. Installing from a Git checkout or packing for npm builds `dist/` automatically via the package's `prepare` script; the published tarball includes the built CLI and type declarations.

## Agent skill

Install the skill separately from GitHub in the consuming project:

```sh
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```

The skills installer detects supported agents and lets you choose a target; pass `--agent <agent>` to select one explicitly, or `--agent '*'` to install for all supported agents. By default it installs in the project; `--copy` copies files instead of using symlinks. The skill does not install the CLI; install both when you need executable evidence and the agent authoring workflow.
