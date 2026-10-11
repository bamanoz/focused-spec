## Context

Checked transitions are an optional CLI/API protocol backed by project-local plans and snapshots, a separate native lifecycle harness, and pending capability specs. The user rejected the entire protocol. The production contract remains state-local bidirectional native binding and real selected evidence execution.

## Goals / Non-Goals

**Goals:** Remove every live transition entrypoint, artifact, instruction and exclusive registration. Keep host-owned transformations, explicit scope-local surviving evidence, source safety, sensitivity checks, and independent public/native evaluation. Preserve historical archives/results and the unrelated active guidance change.

**Non-Goals:** No replacement checkpoints/cache/ancestry/inheritance, compatibility aliases, version bump or push.

## Decisions

1. Delete `src/transitions.ts`, `src/transition-cli.ts`, their exports/dispatch/help, three exclusive test files and `evals/transition-pilot.ts`. Remove stale emitted transition modules before packing. Existing invalid-invocation evidence includes retired command/help forms and must fail before the cutover and pass afterward; this is an observable command contract, not source inspection.
2. Replace the portable checked workflow with the host operation and explicit final registrations/bindings followed by ordinary validation/run. No mandatory before-state artifact. Keep host approval/generated-source ownership and independently executed public lifecycle evidence gates, which are not this CLI protocol.
3. Delete the unpublished checked and rejected simplified planning changes and project plan/snapshot; preserve immutable historical results/archive. Remove the exclusive evidence shard/config source/working registrations and published sharding continuity requirement using this removal delta. Synchronize only this change; keep `cli-owned-agent-guidance` active.
4. Put new working registrations in existing capability-owned shards. Planned exact references:
   - `cli.help.invalid-invocation`: `vitest::test/cli.spec.ts::focused-spec CLI > rejects invalid invocations without treating them as successful help`.
   - `agent.adoption.surviving-evidence`: `vitest::test/evals.spec.ts::agent eval harness > retains checkpointed scope-local evidence after a working document leaves discovery`.
   - `agent.adoption.preserve-native`: existing public native-preservation evidence.
   - `agent.adoption.evidence-continuity`: existing independently judged public lost/redirected evidence case; this remains an evaluator check, not a production checkpoint protocol.
5. Verify real CLI retired invocations, a packed consumer with no transition exports/modules, dangling registry and unregistered marker failures, and selected surviving evidence. Run `npm test`, removal-scope and full focused evidence, Go/pytest smoke, docs links/index reachability and strict OpenSpec checks before the full fresh public/native authoring matrix on `externcash/gpt-6.1-sol`. Save exact immutable model results and a manifest; never relabel old runs or rewrite scores.

## Risks / Trade-offs

- State-only validation cannot detect a consistent deletion of both native binding and registration → intentional accepted limit; do not claim historical loss protection.
- TypeScript build retains stale emitted files → explicitly delete only obsolete transition outputs and verify a packed consumer.
- The word transition also describes legitimate host workflows/eval boundaries → retain those independent checks rather than broad text deletion.
- Native host validation/lifecycle may remain unavailable → report unverified separately from authoring/evidence passes.
