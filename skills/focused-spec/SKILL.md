---
name: focused-spec
description: "MUST-LOAD before any SDD/spec-driven development workflow step that creates, revises, publishes, moves, or completes behavioral requirements or scenarios. This applies across frameworks, artifact formats, and commands, even when the user does not name focused-spec. Load alongside the host workflow skill; bind changed native outcomes to exact evidence and execute it before completion."
---

# Focused Spec

This skill is a loader for workflow guidance owned by the consuming project's installed `focused-spec` package. It intentionally contains no embedded workflow or runner procedure.

## Explicitly requested upgrades

A request to update focused-spec authorizes updating its project-local installation, not a global/downloaded fallback for ordinary specification work. If that is the task, first update only focused-spec using the project's existing package manager and dependency ownership (for npm, typically `npm install --save-dev focused-spec@latest`). Preserve unrelated dependencies and custom integration. Resolve the replacement local CLI, inspect its `init --help`, and refresh the already installed focused-spec loader and package-owned wrappers for the relevant explicit targets. Then load this skill from the replacement installation and obtain the complete workflow response below before migrating project evidence. Do not carry out migration from this bootstrap or a legacy full-text skill. Host approval and installer safety rules still apply.

## Load the project-local workflow before every step

Before **every** focused-spec workflow step, including a later step in the same agent session:

1. Identify the consuming project root from repository or package context. If the project declares a workspace and that context establishes a hoisted installation root, use that root instead.
2. Resolve the `focused-spec` package from that explicit root. Use its project-local executable—normally `<installation-root>/node_modules/.bin/focused-spec`, with the platform-appropriate executable form—or invoke its installed `dist/cli.js` explicitly with Node. Read that same installation's `node_modules/focused-spec/package.json` to establish the expected package name and version.
3. Do **not** use a bare `focused-spec` from `PATH`, a global installation, `npx`, a downloaded package, `latest`, a repository checkout, or guidance retained from an earlier workflow step as a fallback.
4. Invoke the resolved local CLI with `instructions --protocol 1 --topic workflow --json` **as its own tool command** and wait for completion. Do not chain it with installation, `init`, help, another guidance request, or any other command: their output would contaminate the single JSON response. If a combined call already ran, reacquire guidance in a standalone call; extracting one object from concatenated output does not satisfy this contract.
   If the host truncates the displayed output, retrieve the complete stdout from that call's linked output artifact or another full-output capture before validating it. A clipped JSON preview or a separately extracted `content` value is not the complete protocol response.
5. Accept the response only if the command completed successfully and stdout is one valid JSON object whose `protocolVersion` is `1`, whose `package.name` is `focused-spec`, whose `package.version` is a nonempty string equal to the resolved installation's package version, whose `topic` is `workflow`, and whose `content` is nonempty Markdown. Otherwise stop focused-spec work and report that the consuming project needs a complete, compatible local installation; do not continue from global, downloaded, embedded, or stale instructions.
6. Follow the returned content alongside the host workflow. Loading guidance does not authorize writes or other actions forbidden by the host's current phase.

For all later focused-spec commands in that workflow step, use the same explicit local installation that served the accepted guidance. If that installation is upgraded during the step, reload and revalidate its workflow before continuing.

## Load runner guidance on demand

When the accepted workflow calls for runner work, invoke the **same** local CLI with `instructions --protocol 1 --topic runners --json` as its own tool command, never chained with another command. Wait for successful completion and apply the same identity, installed-version, protocol, requested-topic, and nonempty-content checks, with `topic` equal to `runners`. Follow the accepted runner content together with the workflow. Do not use a skill-local or repository reference as a fallback.

If the local package or command is missing, predates `instructions`, rejects protocol 1, fails, or returns malformed, mismatched, or empty guidance, refuse to proceed with focused-spec work until a compatible project-local installation is available.
