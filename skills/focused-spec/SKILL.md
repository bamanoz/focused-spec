---
name: focused-spec
description: "MUST LOAD for behavioral specification work: review, create, revise, plan, publish, regenerate, verify, or complete requirements, acceptance criteria, executable Given/When/Expect scenarios, application drivers, or associated evidence. A meaning-preserving spelling, punctuation, or formatting edit may proceed without mandatory loading only when behavior, scope, conditions, outcomes, identities, selectors, and evidence remain unchanged; uncertain or semantic edits remain covered. Includes SDK-only projects and standalone BDD work, even when the user does not mention focused-spec. Load alongside any host workflow and preserve its approval boundaries."
---

# Focused Spec

This skill activates and routes package-owned guidance. It intentionally embeds no workflow, format, runner, upgrade, or verification procedure.

## Select an installed CLI

Before each focused-spec workflow step, identify the consuming project root from repository or package context. If a workspace establishes a separate dependency owner, keep both roots explicit.

Select one already installed `focused-spec` executable:

1. Use an executable path explicitly supplied by the user or host.
2. Otherwise prefer the consuming project or declared workspace installation when present, so the project can pin its guidance version.
3. Otherwise use an installed `focused-spec` available on `PATH`, including a global installation.

Do not download a package, invoke remote `npx`, use `latest`, or treat a repository checkout or retained guidance as an installed fallback. A global loader does not require a project-local CLI. Complete executable discovery and selection first, then use the selected executable for the focused operation.

For `review`, `author-revise`, `upgrade`, or `verify`, make one standalone request for the requested operation:

```text
<focused-spec-cli> instructions --protocol 1 --topic <operation> --json
```

Validate that response before following it: protocol `1`, package name `focused-spec`, the exact selected installation's nonempty version, the requested operation topic, and complete nonempty Markdown containing clearly separated workflow-router and operation sections. Derive package identity and version from this response; do not make a separate `version` or workflow-only request for the same operation.

Keep that exact executable for the whole workflow step. Do not combine discovery or acquisition with another command or chain.

The CLI installation and consuming project are independent. Project configuration, documents, format/runner packages, and project modules resolve from the explicit project root passed to project-reading commands; they do not resolve from the CLI installation directory.

## Load workflow-only guidance

When no operation topic is needed, make one standalone request containing only:

```text
<focused-spec-cli> instructions --protocol 1 --topic workflow --json
```

Validate the same protocol, package identity/version, exact `workflow` topic, and complete nonempty Markdown. Workflow-only content is router-only. Do not pass a project root to `instructions`; it reads package assets only.

For either request, recover complete stdout from the successful call's linked full-output artifact when the host clips the preview. A clipped preview, extracted `content`, stale guidance, repository file, or different installation is not a substitute. Stop if complete matching output cannot be recovered.

Loading guidance does not authorize writes, installation, configuration, evidence changes, or actions forbidden by the host's current phase. Standalone BDD work needs no SDD host. SDK-only execution needs no focused configuration or CLI plugins.

If the selected installation is upgraded, reacquire fresh guidance. Missing or failed guidance blocks focused-spec work; report it without downloaded, embedded, stale, or repository fallback.
