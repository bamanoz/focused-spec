# Proposal

## Why

focused-spec is both an independent BDD execution engine for code-native Given/When/Expect scenarios and an evidence layer for existing specifications. The installed skill description and onboarding currently restrict mandatory loading to SDD workflows, so an ordinary SDK/driver task without an SDD host can bypass the intended agent guidance.

## What Changes

- Make mandatory agent loading apply to BDD/executable-scenario work as well as SDD/native-requirement workflows, even when the user names neither focused-spec nor SDD.
- Explicitly include reviewing, authoring, revising, and verifying code scenarios and their application drivers, including SDK-only execution without CLI integration.
- Follow a host workflow when one exists; do not require an SDD framework, Markdown companion, registry, or CLI configuration for standalone BDD.
- Align the README, concepts, installation guides, CLI reference, and CLI-owned guidance with the two independent product paths and agent-owned loading.
- Verify blind SDK-only activation and preserved phase boundaries using the existing black-box evaluation infrastructure, rather than a test that only matches documentation wording.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-workflow`: Require workflow-independent skill loading for BDD/SDK scenario work as well as SDD, retaining native execution independence, explicit local guidance provenance, and review/planning boundaries.

## Impact

The authored loader (`skills/focused-spec/SKILL.md`), CLI-owned workflow/integration guidance, README and owning documentation, and focused agent-evaluation cases are affected. SDK APIs, CLI command grammar, configuration and plugin protocols do not change. A future core package release and integration refresh are needed to distribute the changed loader/guidance to existing installations; this change does not publish packages or alter source tags.
