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

## Installation

```sh
npm install --save-dev focused-spec@latest
npx --yes skills add bamanoz/focused-spec --skill focused-spec
```