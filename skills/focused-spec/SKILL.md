---
name: focused-spec
description: "MUST LOAD for behavioral specification work: review, create, revise, plan, publish, regenerate, verify, or complete requirements, acceptance criteria, BDD/code scenarios, or their application drivers. Includes wording-only edits and SDK-only projects, even when the user does not mention focused-spec. Load alongside any host workflow and preserve its approval boundaries."
---

# Focused Spec

This skill activates and routes package-owned guidance. It intentionally embeds no workflow, format, runner, upgrade, or verification procedure.

## Select an installed CLI

Before each focused-spec workflow step, identify the consuming project root from repository or package context. If a workspace establishes a separate dependency owner, keep both roots explicit.

Select one already installed `focused-spec` executable:

1. Use an executable path explicitly supplied by the user or host.
2. Otherwise prefer the consuming project or declared workspace installation when present, so the project can pin its guidance version.
3. Otherwise use an installed `focused-spec` available on `PATH`, including a global installation.

Do not download a package, invoke remote `npx`, use `latest`, or treat a repository checkout or retained guidance as an installed fallback. A global loader does not require a project-local CLI. Complete executable discovery and selection first, then verify that exact executable's package identity and version in a dedicated invocation:

```text
<focused-spec-cli> version --json
```

Keep that exact executable for the whole workflow step. Do not combine discovery or the version check with workflow acquisition in one tool invocation or command chain.

The CLI installation and consuming project are independent. Project configuration, documents, format/runner packages, and project modules resolve from the explicit project root passed to project-reading commands; they do not resolve from the CLI installation directory.

## Load the workflow router

After executable selection and the completed version check, make a new standalone tool invocation containing only:

```text
<focused-spec-cli> instructions --protocol 1 --topic workflow --json
```

Do not pass a project root to `instructions`. Wait for completion, then follow the returned package-owned workflow router alongside the host workflow when present. The router owns focused-topic selection, response handling, full-output recovery, and downstream plugin-document routing. This loader does not duplicate those contracts.

Loading guidance does not authorize writes, installation, configuration, evidence changes, or actions forbidden by the host's current phase. Standalone BDD work needs no SDD host. SDK-only execution needs no focused configuration or CLI plugins.

Use the same selected executable for every focused-spec command in the workflow step. If that installation is upgraded during the step, restart from its fresh loader and workflow. If no compatible installed CLI is available or the workflow request fails, stop focused-spec work and report the missing installation or command failure rather than using downloaded, embedded, stale, or repository guidance.
