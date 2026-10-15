# Proposal

## Why

Shared core guidance duplicates plugin-specific contracts and can disagree with the versions installed by a consumer. Agents need a transparent, offline way to read the exact selected plugin's documentation without core knowing particular adapters or executing their code.

## What Changes

- Add `plugin-docs` for exactly one configured `--format` or `--runner`, or an explicit installed `--package`, with JSON/text provenance, project root and configuration selection.
- Read package-root `README.md` by default or a package-owned `focusedSpec.documentation` Markdown path; support explicit project-relative `documentation` for local-module registrations.
- Fail explicitly on unavailable, empty, malformed or escaping documentation; never import plugins, download packages, search options for nested plugins, or substitute core reference text.
- Remove concrete plugin catalogs, dialects and framework-specific examples from shared formats/runners guidance. Route agents through sequential documentation requests, including nested parsers described by the selected plugin.
- Update CLI/configuration/public documentation and installed loader, keep existing protocol/config/API versions, and prove arbitrary third-party and packed-consumer behavior.

## Capabilities

### New Capabilities

- `plugin-documentation`: explicit installed public contract lookup, provenance, local-module metadata, and fail-closed read-only delivery.

### Modified Capabilities

- `agent-guidance`: shared format/runner topics are plugin-independent and direct agents to selected installed documentation rather than bundled catalogs.

## Impact

Core CLI/configuration/model and documentation resolution; authored guidance and loader; CLI/package behavioral checks and capability-owned evidence. No plugin execution API changes, automatic dependency discovery/composition, version bump, integration reinstall, spec sync, archive, or release.
