# Design

## Context

See proposal.md for motivation. Core already selects a finite topic and reads its own `guidance/<topic>.md`; staging copies the entire authored guidance directory. The general workflow is plugin-independent. Each official format owns a public README; runner guidance demonstrates a separate optional core reference without loading plugins.

## Goals / Non-Goals

**Goals:** preserve offline, read-only, installation-bound delivery and the protocol-1 envelope while making format work discoverable through the same mechanism as runner work.

**Non-Goals:** dynamically enumerate installed plugins, read their implementations, infer configuration, introduce a topic registry abstraction, or change format/runner runtime APIs. Package versions and existing unrelated changes remain untouched; no sync/archive is part of this implementation.

## Decisions

- Extend the existing literal topic union, argument validation, help, and documentation with `formats`; use the existing asset read and fail-closed path. No new loader protocol or dependency is required.
- Author `guidance/formats.md` as a standalone offline topic: shared selection/enrollment/provenance/verification rules first, then the four official adapters' scoped syntax/configuration reference. Third-party contracts remain plugin-owned; this is not plugin discovery or a fixed allowlist.
- Keep workflow routing short and generic. Add formats acquisition to the thin loader using the same standalone-command and response identity checks as runners. Never embed plugin procedure in the skill.
- Extend existing packed-guidance checks to cover formats JSON/text from a core-only consumer. Add one CLI case for invalid-project/plugin independence and one missing-formats-asset boundary. Do not add tests that pin instructional wording.

## Risks / Trade-offs

- Official reference can drift from package READMEs → exercise its inline/registry Markdown/Gherkin examples through the real CLI and keep package-specific details scoped; exported public contracts remain the source for third-party behavior.
- A new topic could be accepted but omitted from the tarball → extend the existing source-independent packed consumer check, not only workspace execution.
- A generic fallback could hide an incomplete install → explicitly remove the formats asset in an isolated package and require nonzero exit with empty stdout despite available other topics.

## Verification and evidence

- `guidance.delivery.formats`: `vitest::test/cli.spec.ts::focused-spec CLI > serves format guidance without loading project configuration or plugins`.
- `guidance.delivery.formats-incomplete`: `vitest::test/cli.spec.ts::focused-spec CLI > rejects missing format guidance without falling back to other topics`.
- Retained modified scenarios reuse their exact existing CLI/package test selectors in the new scope. `distribution.package.agent-guidance` uses the extended source-independent packed installation test.
- Build and run narrow CLI checks; run `npm test`; strict-validate and execute the new scope. Demonstrate PASS → missing formats topic rejection under a controlled isolated core-routing regression → restored PASS with the exact format-delivery selector. Independently smoke-test topic help/JSON/text and native authoring examples, validate documentation links, and check staged mirrors and pack inventory.

## Migration Plan

This is an additive topic with unchanged protocol 1 and default workflow behavior. Staging/build/pack includes the new asset automatically. Existing loaders continue working; refreshed loaders can request formats on demand. No consumer configuration migration or installation-side agent-file writes occur.
