# Proposal

## Why

The installed loader still carries procedure that the package CLI can enforce, while the workflow response is large enough to be truncated by agent hosts. This makes guidance acquisition depend on fragile agent-side provenance checks and repeated artifact recovery, even though the CLI already owns the authoritative package assets.

## What Changes

- Support guidance from a selected installed CLI regardless of whether it is project-local, global, or explicitly located; keep project configuration and plugin resolution rooted in the consuming project.
- Keep protocol, package identity, requested topic, and nonempty-content validation inside the CLI; expose focused `review`, `author-revise`, `upgrade`, and `verify` guidance topics alongside the existing shared topics.
- Replace the large workflow document with a compact router that points agents to the smallest applicable topic and preserves native-source, host-phase, plugin-contract, and evidence-boundary rules.
- Reduce the installed `SKILL.md` to activation, installed-command selection, and topic routing; keep detailed procedure in CLI-owned guidance.
- Update the CLI reference, installation guidance, documentation map, executable package tests, and activation checks for focused topics and installation-independent guidance.
- Preserve offline operation, protocol 1 response shape, existing `integration`/`formats`/`runners` behavior, native source ownership, and host approval boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-guidance`: Deliver package-owned workflow procedure through a compact router plus focused topics without a project-ownership requirement.
- `agent-workflow`: Acquire complete guidance from the selected installed executable while preserving project-root plugin resolution and host boundaries.

## Impact

Affected authored guidance under `guidance/`, the installed loader under `skills/focused-spec/SKILL.md`, core CLI instruction parsing and help, package staging and packed-consumer tests, OpenSpec guidance evidence, and owning reference documentation. No SDK runtime, format API, runner API, dependency, or configuration-version change is intended.
