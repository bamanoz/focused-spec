## Why

Focused-spec connects scoped behavioral items to exact executable evidence; it does not own the host framework's revision history. Requiring an owner and a REVISES graph makes independent scopes depend on documents outside the selected evidence context and causes the eval harness to miscount legitimate same-ID occurrences.

## What Changes

- **BREAKING**: remove REVISES metadata, revision fields in the public Scenario model, and cross-scope ownership validation. Identity is unique within `(scope, ID)`, not repository-wide.
- Permit the same stable ID in separate scopes without links, owners, or inferred ancestry. Require explicit evidence on each occurrence; do not inherit tests or bindings.
- Preserve within-scope duplicate rejection, selected-scope isolation, all-scope execution, and scoped result identity.
- Make eval judgments inspect the configured selected scope instead of counting same-ID occurrences as competing owners. Preserve durable evidence after working documents leave discovery without requiring revision links.
- Migrate live examples, tests, skill guidance, and documentation. Retain historical archived change artifacts and saved eval results unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scenario-authoring`: scope-local identity and enrollment without revision metadata.
- `validation`: scope-local duplicate checks and no cross-scope ownership dependencies.
- `scenario-execution`: independent evidence execution for same-ID occurrences across scopes.
- `agent-workflow`: scope-aware eval judgments and evidence-preserving document transitions without owner graphs.

## Impact

Public Scenario types, parser, validator, CLI help, affected behavioral tests, eval judges and fixtures, installed focused-spec workflow, owning documentation, and the four capability contracts. No native-ID CLI implementation, new runner protocol, reserved scope name, OpenSpec workflow modification, package release, or unrelated native-pilot selector fix is included.
