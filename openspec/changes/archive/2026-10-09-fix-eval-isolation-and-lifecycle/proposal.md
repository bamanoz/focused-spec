## Why

Eval provisioning runs package lifecycle scripts against the shared repository distribution and replaces shared tarballs while parallel consumers use them. Brownfield completion judges a working scope after the requested lifecycle has legitimately removed it from discovery, producing false failures.

## What Changes

- Pack the already-built distribution without lifecycle scripts into independently owned temporary package directories; clean both packages and workspace together.
- Build once before the npm eval entrypoint, not inside per-workspace packaging.
- Divide brownfield apply and sync into natural workflow turns, with independently executed working evidence captured before sync and surviving main evidence judged afterward.
- Preserve exact evidence continuity, native-history preservation, integrity, and controlled mutation checks; do not alter previous results or add identity/selector hints to task prompts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-workflow`: isolated provisioning and phase-correct working-to-main evidence judgment.

## Impact

Changes eval provisioning, case turns, checkpoint orchestration, lifecycle judges, behavioral tests, and the owning agent-eval documentation. The CLI identity and runner API contracts are unchanged.
