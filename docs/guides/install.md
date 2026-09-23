# Install

## CLI

From a checkout or source tree:

```sh
./install.sh
```

The script only installs the CLI package as a development dependency:

```sh
npm install --save-dev focused-spec
```

It requires Node.js 24 or newer. Override the package or npm executable when needed:

```sh
FOCUSED_SPEC_PACKAGE=@your-scope/focused-spec NPM_BIN=/path/to/npm ./install.sh
```

## Agent skill

Install the bundled `focused-spec` skill separately with `npx skills`:

```sh
npx --yes skills add . \
  --skill focused-spec \
  --agent '*' \
  --copy \
  --full-depth \
  --yes
```

Use a different source tree by replacing `.` with its path. The installer does not install skills automatically; package installation and agent configuration stay independent.
