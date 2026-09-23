# focused-spec

`focused-spec` connects small behavioral scenarios to exact executable evidence. The core is language- and test-framework-agnostic; projects provide local runner plugins for their own test stacks.

## Start here

- [Documentation map](docs/README.md)
- [Concepts](docs/concepts/README.md)
- [Install the CLI and agent skill](docs/guides/install.md)
- [Configure scenarios](docs/guides/configuration.md)
- [Implement runners](docs/guides/runners.md)
- [CLI reference](docs/reference/cli.md)
- [Development workflow](docs/development/README.md)
- [Agent evals](docs/development/agent-evals.md)

## Quick start

Requirements: Node.js 24 or newer, plus the language runtimes used by project runners.

```sh
./install.sh
focused-spec validate
focused-spec run
```

The installer only installs the CLI package. Install the bundled agent skill separately:

```sh
npx --yes skills add . \
  --skill focused-spec \
  --agent '*' \
  --copy \
  --full-depth \
  --yes
```

## Example

The polyglot example proves one scenario through both Go and pytest:

```sh
npm run smoke
```

## Development checks

```sh
npm test
npm run smoke
```

Durable coding-agent rules live in [AGENTS.md](AGENTS.md).