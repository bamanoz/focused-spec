## Why

The user explicitly chose to remove checked transitions rather than simplify their checkpoint interface. Ordinary native-binding validation and actual selected evidence execution remain the product boundary; historical before/after preservation is not worth a separate optional lifecycle protocol for this project.

## What Changes

- **BREAKING**: remove the transition command, help, public preparation/verification API and types, file/cache checkpoint concepts, separate transition evaluation harness, and transition-only tests.
- Reject retired transition invocations as unknown commands, with no aliases, compatibility readers, or replacement mechanism.
- Replace mandatory preparation/snapshot/verification steps with the host-owned operation, explicit surviving scope-local registry/bindings, normal validation, and actual surviving evidence execution. Keep bidirectional missing-binding checks and no evidence inheritance.
- Remove the unpublished checked-transition and simplified-transition planning changes, their executable registrations, and the retained project-local registry-sharding transition plan/snapshot. Preserve immutable eval results and archived historical artifacts; leave the unrelated guidance change active.
- Remove published sharding requirements/registrations that only exist for transition snapshots. Preserve all ordinary registry composition, provenance, source safety, scope selection, and duplicate/binding checks.
- Run a fresh full public and native authoring model matrix against the updated package-owned workflow; preserve actual host lifecycle checks already provided by those harnesses without inventing a replacement checkpoint protocol.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-help`: the retired transition command and help forms fail; current validate/run/instructions discovery remains intact.
- `agent-workflow`: native publication/movement/regeneration uses normal binding validation and selected surviving execution without transition artifacts.
- `evidence-registry-sharding`: remove the checked-transition continuity requirement; ordinary logical registry behavior is unchanged.

## Impact

Source/API, CLI, instructions, documentation and indexes, obsolete tests/eval entrypoint, repository executable registrations and active planning artifacts. No config/runner/protocol/version changes, no push, and no revival of REVISES or evidence inheritance. Intentional limit: deleting both a native item and its registration, or changing both consistently, is not detected as historical loss by state-only validation. The implementation does not claim such mistakes are impossible.
