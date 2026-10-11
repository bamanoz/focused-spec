## Why

The CLI and separately installed focused-spec skill can come from different releases. A frozen copy of the complete workflow can therefore instruct an agent to use a contract its installed CLI does not support, even when both installations succeeded.

## What Changes

- Add an offline `instructions` CLI command serving package-owned workflow and on-demand runner guidance, independently of project configuration.
- Replace the installed skill's full workflow with a small discoverable loader that obtains instructions from the consuming project's installed CLI before focused-spec work.
- Introduce loader protocol version 1, distinct from package versions, configuration version 3, and runner API version 1. Unsupported protocol requests fail without emitting usable guidance.
- **BREAKING**: only the new loader and CLI-owned guidance format are supported. Do not retain legacy full-text skills, format readers, aliases, shims, conversion commands, or fallback paths. The new loader requires a CLI supporting `instructions`; unsupported installations fail explicitly. Existing `validate`, `run`, public types, current configuration, and runner contracts remain unchanged.
- Keep full workflow guidance authoritative in the npm package, not duplicated in installed skills. Reload it for subsequent workflow steps and after a CLI update.
- Existing consumer projects are migrated separately by their agents at the user's request, not by product migration tooling. Document the new installation and session-reload requirements; do not silently rewrite customized instructions or claim already-read session text can be retracted.
- Extend help and black-box activation checks to distinguish loading the skill from successfully obtaining the installed CLI's workflow.

## Capabilities

### New Capabilities

- `agent-guidance`: offline, package-owned guidance delivery with a stable versioned loader protocol and explicit failures.

### Modified Capabilities

- `distribution`: packed installs include the authoritative guidance as well as the separately installable loader.
- `cli-help`: discover and explain `instructions` alongside `validate` and `run`.
- `agent-workflow`: load guidance from the project-local CLI, fail closed when unavailable, and verify actual guidance acquisition in new black-box evaluations.

## Impact

- CLI dispatch/help in `src/cli.ts`; a small package-relative guidance reader; packaged guidance assets and `package.json.files`.
- `skills/focused-spec/SKILL.md` and its existing runner reference, with a clean cutover rather than a second maintained workflow copy.
- Packed-consumer and CLI checks; eval provisioning and activation judgment; a mandatory fresh run of every public eval and every native host in both revision and creation modes, with unchanged blind prompts and evidence/integrity gates, before completion.
- Owning installation, CLI, runner, evaluation, and documentation-map pages; root quick-start pointers only where necessary.
- Planning is confined to this change's artifacts. Evidence-registry integration, product changes, installer runs for the new loader, and model evaluations belong to apply. No package-version bump or release is included.
