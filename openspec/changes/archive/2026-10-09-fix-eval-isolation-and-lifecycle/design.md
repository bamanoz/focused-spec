## Context

The observed module-export error occurs while npm pack invokes prepare and rebuilds shared dist. Provisioning also removes a shared tarball before repacking. The brownfield task explicitly checks evidence after the working document leaves discovery, but completion always validates and mutates the old working scope.

## Goals / Non-Goals

Goals: default parallel npm test; independent installed packages; working PASS before sync; surviving main PASS and sensitivity afterward; exact evidence continuity.

Non-goals: score rewriting, retries until a model passes, relaxed integrity gates, runner changes, native-ID implementation, or installed host workflow edits.

## Decisions

1. Use the existing package-test convention npm pack --ignore-scripts. Build once at the npm eval entrypoint; npm test already builds before Vitest. Each provisioned workspace owns its package directory outside the evaluated project, with cleanup on both success and provisioning failure. Do not serialize unrelated tests or share mutable tarballs.
2. Use the harness's existing per-turn checkpoint boundary. The apply turn must independently validate and execute its working occurrence; a failed checkpoint stops before sync. The sync turn can remove working discovery. Preserve the executed evidence references as checkpoint data, not agent claims or transcript PASS strings.
3. Judge final brownfield validation, execution, and controlled product mutations against the configured surviving main scope. Compare its explicit evidence with checkpoint evidence and the retained working document; never inherit evidence or re-enable excluded documents to manufacture a pass.
4. Retain the direct transition gate for discovered working scopes; allow the final lifecycle gate to use the independently executed checkpoint when working discovery has legitimately ended. Both paths reject missing, redirected, or altered evidence.

## Risks / Trade-offs

- Direct strip-types harness invocation requires an existing build; document npm run eval:agent as the build-owning entrypoint.
- Brownfield now uses two fresh authoring turns, matching the real apply/sync phase boundary; saved single-turn results remain unchanged.
- Runtime evals are model-specific. Any fresh failure remains a recorded failure rather than being rerun until green.
