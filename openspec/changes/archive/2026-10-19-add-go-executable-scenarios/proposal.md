# Proposal

## Why

The independent JS/TS bank example demonstrates executable Given/When/Expect specifications, but does not establish whether the same model fits idiomatic Go. A Go SDK and the same bank behaviors will test that boundary without making focused-spec core language-aware or maintaining duplicate Markdown scenarios.

## What Changes

- **BREAKING (repository example paths):** move the current consumer from `examples/scenarios/` into `examples/scenarios/typescript/`, preserving all six IDs, outcomes, standalone commands and the optional `node:test` wrapper explanation. Migrate active callers and documentation; do not retain an obsolete executable entrypoint at the parent path.
- Add a standard-library-only Go module at `packages/sdk/go/`, with typed scenarios and drivers, exact comparison, isolated inputs, context cancellation and cleanup. It must run without Node.js, npm, focused-spec or a test framework.
- Add `examples/scenarios/go/`: the same real event-sourced account and six scenarios, ordinary Go tests and a readable standalone demo. Each language owns its native code scenarios; neither requires a Markdown companion.
- Add independently installed `@focused-spec/format-scenarios-go` and `@focused-spec/runner-scenarios-go`. Use Go's parser for static native discovery and invoke the same Go SDK for exact selected execution. Preserve existing Format API 2, Runner API 1 and CLI contracts.
- Demonstrate list/show, strict validation, one-ID and complete execution for both consumers. Prove a real withdrawal-boundary regression fails standalone and focused execution in each language.
- Document SDK/module installation, plugin prerequisites, trust limits, example commands and clean-consumer distribution. Package the Go parser source with its owning npm plugin rather than depending on this checkout.

## Capabilities

### New Capabilities

- `go-executable-scenarios`: Independent Go scenario execution, static native discovery, direct focused-spec execution and clean-consumer distribution.

### Modified Capabilities

None among the published main specs. The implemented `executable-scenarios` capability exists only in the completed, unsynced `add-executable-scenario-sdk` change. This change depends on that implementation and explicitly supersedes its JS/TS-only and single-example-path statements for future composition; it does not edit or archive that change. If the earlier delta is synchronized first, publication must reconcile its demonstration requirement with the two language subdirectories, not restore the obsolete path.

## Impact

- New Go module `github.com/bamanoz/focused-spec/packages/sdk/go`, minimum Go 1.23, with no external dependencies; Go module release tags use the module-directory prefix and are separate from npm suite tags.
- New plugin workspaces under `packages/formats/scenarios-go/` and `packages/runners/scenarios-go/`; npm manifests, lockfile, build/staging and package inventories grow from eleven to thirteen npm packages. The Go module is not an npm workspace package.
- Move the existing consumer and migrate `test/executable-scenarios.spec.ts`, repository command examples and links. Add Go behavioral checks and isolated consumer coverage in `test/go-executable-scenarios.spec.ts` and native SDK tests.
- During apply, add capability-owned `.focused-spec/evidence/go-executable-scenarios.yaml`; preserve unrelated evidence and current-scope contracts. Proposed exact bindings belong in design/tasks until apply.
- Update owning configuration, runner, installation, development/release documentation and indexes. No core language branches, publication, version bump, tag, OpenSpec sync/archive or unrelated integration changes are part of this implementation.
