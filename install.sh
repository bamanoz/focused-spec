#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${FOCUSED_SPEC_PACKAGE:-focused-spec}"
NPM_BIN="${NPM_BIN:-npm}"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'focused-spec requires Node.js 24 or newer; node was not found.' >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$node_major" -lt 24 ]]; then
  printf 'focused-spec requires Node.js 24 or newer; found %s.\n' "$(node --version)" >&2
  exit 1
fi

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  printf 'npm executable not found: %s\n' "$NPM_BIN" >&2
  exit 1
fi

printf 'Installing %s as a development dependency...\n' "$PACKAGE_NAME"
"$NPM_BIN" install --save-dev "$PACKAGE_NAME"


printf '%s\n' 'focused-spec CLI installation complete.'
