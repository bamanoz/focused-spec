## Why

Consumers currently need a separate GitHub-based skill installer even though the npm package already bundles the focused-spec loader. An explicit local `init` command can install version-coherent agent integration offline while preserving project ownership and custom instructions.

## What Changes

- Add `focused-spec init [path] --tools <IDs> [--dry-run] [--json] [--replace]`, independently of project evidence configuration.
- Copy the bundled thin loader into selected project-local agent locations: Oh My Pi, Claude Code, Codex, and the shared `agents` target.
- Install one minimal `/focused-spec` skill-loading wrapper for Oh My Pi and Claude Code; Codex/shared targets remain skills-only.
- Offer interactive target selection; require explicit targets in noninteractive and JSON invocations. Detect directories only as suggestions, not authorization.
- Preflight every destination: identical files are unchanged, missing files are installed, divergent files conflict unless replacement is explicitly authorized. Do not follow destination symlinks outside the project or replace unrelated files.
- Keep npm installation side-effect-free. Do not generate evidence configuration, runners, native specifications, global settings, or `AGENTS.md`; installation success does not certify evidence readiness or execution.

## Capabilities

### New Capabilities

- `agent-init`: Explicit offline agent integration, tool selection, preview/reporting, safe reinitialization, and project-local write boundaries.

### Modified Capabilities

- `cli-help`: Discover the init command and explain its options without reading project state or writing files.

## Impact

- CLI routing/help and a small package-relative installer with explicit target mappings and bundled command wrappers.
- Consumer-facing installation and CLI reference documentation; capability/documentation indexes.
- Real packed-consumer CLI evidence for installation, conflict preservation, explicit replacement, preview, invocation errors, shared-root deduplication, symlink boundaries, and no implicit runtime setup.
- No runtime registry/configuration format, guidance protocol, runner API, postinstall hook, release, or implementation is part of this proposal phase.
