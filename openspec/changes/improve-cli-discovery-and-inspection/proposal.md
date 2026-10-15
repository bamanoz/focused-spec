# Proposal

## Why

The small flat CLI fits focused-spec, but agents cannot identify its executable directly, receive inconsistent machine-readable invocation failures, cannot validate the same scenario selection they can run, and cannot inspect enrolled evidence without resolving or executing it. Keep the command tree simple while making these boundaries explicit and discoverable.

## What Changes

- Add offline `--version`/`-V` and `version [--json]` identifying the invoked package, executable, runtime and supported contract versions without project configuration or plugins.
- **BREAKING**: JSON-mode invocation failures and uncaught command failures use one structured stderr error with empty stdout; keep existing command-specific validation, execution and installation result shapes. Init argument errors join this transport instead of masquerading as installation reports.
- Permit `validate --scenario <id>` with exactly the same scope/ID isolation as run, preserving non-strict, strict and syntax-only distinctions and reporting the actual narrowed validation scope.
- Add read-only `list` and `show <id>` for format-provided enrollments, exact evidence and native/evidence provenance. Inspection parses/binds and validates normalized structure but never loads runners, resolves executable targets, executes tests, scans packages or interprets opaque options.
- Update installed help, owning CLI documentation, portable workflow and exact scope-local behavioral evidence. Preserve the existing flat commands, explicit root/config selection and generic plugin boundaries.

## Capabilities

### New Capabilities

- `evidence-inspection`: deterministic read-only enrollment inventory and exact scope-aware lookup with native and per-reference provenance.

### Modified Capabilities

- `cli-help`: offline version identification, expanded flat command discovery and structured JSON invocation failures.
- `validation`: symmetric scenario selection for standalone validation and execution preflight.
- `agent-init`: distinguish invalid invocation transport from truthful installation result reporting.

## Impact

Core CLI parsing/dispatch, small CLI-only version/error/inspection modules, initialization and instructions argument errors, existing public help/selection tests, new CLI boundary and inspection tests, package-consumer coverage, capability-owned evidence and indexed documentation. No new dependency, public TypeScript export, config/plugin/guidance protocol version change, integration reinstall, package version bump, release, specification sync or archive. Earlier completed changes remain intact and unarchived.
