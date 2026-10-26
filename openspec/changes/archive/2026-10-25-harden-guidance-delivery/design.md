# Design

## Context

See [proposal.md](./proposal.md) and the [agent-guidance delta](./specs/agent-guidance/spec.md). The current CLI already reads package-owned guidance and returns protocol-1 JSON, but the loader repeats package/version/topic/content checks and the default workflow document is large enough to be truncated by agent hosts. Existing `integration`, `formats`, and `runners` topics are independently packaged and must remain compatible.

The repository uses a workspace-linked core package during development and stages authored `skills/` and `guidance/` into `packages/core` for packed consumers. Tests exercise both the source CLI and fresh packed installations. The change must not hand-edit generated mirrors.

## Goals / Non-Goals

**Goals:**

- Allow a selected compatible CLI to serve guidance regardless of installation location.
- Deliver a short workflow router and focused package-owned topics without changing protocol-1 response shape.
- Keep the loader small enough to remain a durable activation shim.
- Preserve offline, config-free topic delivery and existing plugin provenance boundaries.
- Add behavioral coverage for installation-independent guidance, focused-topic delivery, compact routing, and packed distribution.

**Non-Goals:**

- No new probe/status commands from later improvement blocks.
- No SDK, format API, runner API, configuration-version, or evidence-storage change.
- No automatic installation, package downloads, stale embedded guidance, host hooks, or context-file markers.
- No removal of existing `integration`, `formats`, or `runners` topics.

## Decisions

### 1. Separate CLI identity from project ownership

The selected installed CLI may be project-local, global, or explicitly located. `instructions` reads its own package assets and validates package identity, protocol, requested topic and nonempty content without resolving a consuming-project installation. Do not add `--root` to `instructions`: it reads no project state. Other commands retain `--root` for project configuration and plugin resolution.

Use the same selected executable throughout a workflow step; a local dependency remains useful for version pinning but is not mandatory. Activation checks validate the complete response against the serving installation, not a hardcoded consumer-local path. No automatic download or stale embedded fallback is introduced.

The protocol-1 response fields remain unchanged. Rejected alternative: enforce package ownership through a consumer-root comparison. The user explicitly rejected that restriction; location is not compatibility.

### 2. Use a router plus four focused topics

Replace `guidance/workflow.md` with a concise router. Add `review.md`, `author-revise.md`, `upgrade.md`, and `verify.md`, each containing only the obligations needed for that route and links by command to shared integration/format/runner guidance. Extend the topic allowlist and package staging by copying the complete authored guidance directory as before.

Alternative rejected: retain one large workflow and rely on artifact recovery. That preserves the known truncation failure mode and makes every workflow step pay the full response cost.

The topic files remain package-owned Markdown, not runtime modules. The CLI reads the requested filename from its own package only, preserving the existing no-config/no-plugin/no-network contract.

### 3. Keep protocol and topic identity explicit

The protocol remains `1`; the JSON response remains `{ protocolVersion, package, topic, content }`. New topic values are explicit and validated against a static allowlist. Unknown topics and missing assets fail closed with the existing structured CLI error behavior. Text mode continues to print package/version/protocol/topic provenance before content.

Alternative rejected: overload one topic with a `section` option. Separate topic names make each response independently cacheable, testable, and bounded without adding nested response semantics.

### 4. Keep focused-spec loader procedure-free

The authored loader retains frontmatter, activation scope, installed CLI selection, one standalone workflow request, routing to a selected topic, and the rule to retain the same installation. It does not restate protocol field validation, artifact truncation recovery, package documentation schemas, upgrade steps, evidence ownership, or verification commands. Those remain in CLI-owned topics.

Alternative rejected: leave the current loader unchanged and only add topics. That would preserve the duplication and stale-procedure risk this change targets.

### 5. Evidence plan

The exact implemented references below are enrolled in the existing capability-owned guidance evidence registry for this change scope:

| Native ID | Exact Vitest evidence |
| --- | --- |
| `guidance.delivery.installation-independent` | `vitest::test/cli.spec.ts::focused-spec CLI > serves guidance from an installation outside the project` |
| `guidance.delivery.focused-topic` | `vitest::test/cli.spec.ts::focused-spec CLI > serves focused guidance topics without project setup` |
| `guidance.delivery.offline` | `vitest::test/cli.spec.ts::focused-spec CLI > serves workflow guidance without project setup` |
| `guidance.delivery.compatible-update` | `vitest::test/package.spec.ts::package distribution > refreshes guidance after a compatible package replacement` |
| `guidance.plugins.router` | `vitest::test/package.spec.ts::package distribution > ships a compact loader and complete focused guidance topics` |

Existing unchanged guidance outcomes retain their current evidence. Apply must implement every planned target, replace each `planned:` prefix with the exact final selector, run strict validation and execute the complete scope. The controlled proof must show that changing the serving package or removing a requested topic cannot silently fall back to another source, and that the original package remains byte-identical after disposable checks.

## Risks / Trade-offs

- [Risk] Different installed versions can supply different procedure. → Retain the selected executable and reload after an upgrade; optional local dependency pinning remains supported.
- [Risk] Topic splitting can omit a rule from the former workflow. → Derive topics from the existing workflow sections, retain routing/completion invariants in the router, and compare authored guidance coverage during review.
- [Risk] Existing activation checks assume a project-local package. → Resolve identity and bytes from the serving executable while keeping project-owned plugins isolated.
- [Risk] Existing tests and docs assume only four topic names. → Update help, references, fixtures, and packed-consumer checks in the same apply change; preserve the old topic names and response fields.

## Migration Plan

1. Implement topic parsing, authored guidance assets, loader, help, docs, activation checks, and focused regression tests.
2. Build/stage the workspace and exercise each topic from the linked CLI and a fresh packed consumer with malformed configuration and network unavailable.
3. Enroll the exact implemented Vitest selectors in the existing guidance evidence owner, replace all planned references, run strict validation and the change scope, then run full repository checks.
4. If rollback is required, restore the prior loader, workflow asset, topic allowlist and activation checks; no consumer configuration or SDK migration is needed.

## Open Questions

None. Topic names, protocol fields, installation independence and evidence ownership are fixed by this design and the delta spec.
