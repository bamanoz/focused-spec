# Proposal

## Why

Core review reproduced three boundary defects: JSON transport can silently repair invalid plugin responses, the valid runner ID `planned` cannot execute concrete evidence, and opaque values can inject terminal controls into human output.

## What Changes

- Reject non-JSON plugin responses before serialization in both hosts, retaining receiver-side validation.
- Distinguish deferred `planned:` evidence from concrete `planned::selector`.
- Escape opaque values in human execution, validation, inspection and error output while preserving selectors and JSON values.
- Add real CLI regressions and update owning references.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runner-protocol`: invalid responses fail before lossy transport.
- `project-configuration`: format responses cannot lose invalid fields during transport.
- `validation`: planned evidence syntax does not reserve a runner ID.
- `scenario-execution`: human presentation cannot execute terminal control sequences.

## Impact

Core hosts, shared JSON validation, reference parsing, human rendering, behavioral tests and capability-owned evidence registries. Plugin API versions and JSON result shapes remain unchanged. Invalid plugin output intentionally stops passing. No dependency or package version changes.
