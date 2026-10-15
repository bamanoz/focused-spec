# Proposal

## Why

The plugin-independent workflow can request runner guidance but has no equivalent format topic. Agents need an offline, package-owned entry point for format selection, identity/evidence authoring, and the official adapters without reopening core workflow coupling.

## What Changes

- Add `instructions --topic formats` using the existing protocol-1 JSON/text envelope and static package-owned guidance delivery.
- Ship `guidance/formats.md` with shared format rules and a clearly scoped reference for the four official adapters; preserve per-plugin READMEs as their exact installed contracts.
- Route format work from the loader and generic workflow to this on-demand topic, preserving standalone requests, host phase boundaries, and plugin independence.
- Extend offline and packed-consumer checks to formats, including missing-topic fail-closed behavior; update owning documentation and exact scenario evidence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-guidance`: accept and deliver the formats topic without configuration, plugins, network access, or project writes; preserve protocol and missing-asset behavior.
- `distribution`: ship workflow, formats, and runners guidance and a loader that acquires the applicable on-demand topic without source-checkout access.

## Impact

Core topic argument parsing/help; package-owned guidance and loader; CLI/package tests and project-local evidence registrations; CLI/configuration/installation/release documentation and indexes. No plugin runtime/API, package-version, automatic plugin-documentation discovery, installation-side migration, spec sync, or archive changes.
