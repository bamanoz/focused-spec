# Proposal

## Why

Updating the CLI alone leaves old agent instructions and version-2 inline evidence behind. An agent asked only to update focused-spec needs shipped instructions that carry the project through an evidence-preserving migration without access to this repository.

## What Changes

- Add a permanent upgrade procedure to package-owned workflow guidance: refresh the explicitly requested local package and installed integration, acquire fresh authoritative instructions, then migrate obsolete configuration and evidence.
- Make obsolete configuration and inline-row diagnostics advertise the explicit local instruction command.
- Preserve behavioral text, scope-local IDs, exact evidence selectors, AND contracts, runner configuration, and unrelated integrations; remove obsolete metadata rather than add compatibility support.
- Add a blind agent evaluation starting from genuine published version 0.5.0 and its full-text skill, with independently verified candidate distribution and preservation gates.
- Keep ordinary loader acquisition fail-closed; an explicitly requested package upgrade is not a fallback for unrelated specification work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-guidance`: actionable obsolete-format diagnostics lead to package-owned upgrade guidance.
- `agent-workflow`: an authorized update includes integration refresh and evidence-preserving project migration; black-box evaluation bounds legitimate package replacement.

## Impact

`guidance/workflow.md`, the portable loader, configuration/parser diagnostics, public CLI tests, and the agent eval provisioner/judges/fixtures. Owning install/configuration/CLI/eval documentation changes with the behavior. No new command, guidance topic, protocol, runner API, automatic converter, legacy runtime, or release is introduced.