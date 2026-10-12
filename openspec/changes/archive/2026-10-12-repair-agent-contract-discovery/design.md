# Design

## Context

See proposal.md. Captured tool calls show actual runner dist JavaScript searches, not a false-positive integrity gate. Installed official packages have no README. The core already supplies complete public selector documentation through the runners topic, but authoring-time research attempted package docs before loading that topic. Upgrade invoked init and guidance in one command, producing two JSON values.

## Goals / Non-Goals

**Goals:** Fix all three failed cases by making the intended public research path available and unambiguous; retain blind prompts, gates and immutable scores.

**Non-Goals:** Change protocol acceptance, add compatibility fallbacks, alter host validators or claim unexercised lifecycle certification. Release/publish/commit/tag/push remain forbidden.

## Decisions

- Generate runner READMEs from existing docs/guides/runners.md in the existing asset-staging script. Rewrite relative documentation links to canonical repository URLs; do not maintain additional authored docs or embed a duplicate agent procedure.
- Add runnable selector examples for every runner in the owning guide. A packed consumer test discovers these examples from its installed READMEs and runs protected real tests through the CLI. Its PASS/FAIL results defend useful documentation rather than pinning prose.
- Explicitly run instructions alone, never chained with init, installation or another JSON-producing command. Reject concatenated JSON as before. Keep existing package identity/version checks.
- State that public manifests, READMEs, declarations, framework collection and project-owned tests provide contracts. Installed plugin JavaScript is not a substitute for public documentation.

## Exact evidence

- distribution.runner.public-contracts → vitest::test/package.spec.ts::package distribution > executes selectors discovered from packed runner documentation.
- Upgrade/contract-discovery guidance is proven by genuine fresh project-upgrade, registry-shards-new-boundary and full-skill-routing runs, not tests asserting instruction text.
- Run full npm test, all nine public cases, all seven native hosts in revision/create modes. Preserve every immutable artifact and report actual limitations. Controlled distribution regression removes generated public READMEs, requiring the selected consumer evidence assertion to fail, then restores build assets and observes PASS.

## Risks / Trade-offs

Generated READMEs show all official runners rather than three specialized authored copies; this keeps the selector contract in one owner. Fresh model runs may reveal additional failures; repair their causes without leaking scored hints into prompts or relaxing gates. Native unavailable validators remain unverified.
