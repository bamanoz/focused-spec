---
name: focused-spec
description: "MUST-LOAD before any SDD/spec-driven development workflow step that reviews, creates, revises, publishes, moves, or completes behavioral requirements or scenarios. This applies across frameworks, artifact formats, and commands, even when the user does not name focused-spec. Load alongside the host workflow skill; reconcile changed native outcomes with exact evidence and execute it before completion, respecting read-only and planning boundaries."
---

# Focused Spec

This skill is a loader for workflow guidance owned by the consuming project's installed `focused-spec` package. It intentionally contains no embedded workflow, format, or runner procedure.

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

## Load format and runner guidance on demand

When the accepted workflow calls for format selection, configuration, authoring, or implementation, invoke the **same** local CLI with `instructions --protocol 1 --topic formats --json`. For runner selection, configuration, or implementation, use `instructions --protocol 1 --topic runners --json` instead.

Each request is its own tool command, never chained with installation, another topic, or another command. Wait for successful completion and apply the same complete-response, identity, installed-version, protocol, requested-topic, and nonempty-content checks, with `topic` equal to the requested `formats` or `runners`. These topics contain shared core obligations, not plugin catalogs. Do not use a skill-local or repository reference as a fallback.

Acquire a selected plugin's complete public document in a separate standalone command from that same CLI: `plugin-docs --format <id> --json` or `plugin-docs --runner <id> --json` for configured registrations, with optional `--root <path>` and registration-only `--config <path>`; use `plugin-docs --package <specifier> --root <path> --json` for an explicit installed package without reading configuration. Exactly one selector is required. Accept only the workflow's exact JSON object: requested `selection`; either package specifier, manifest name/version and canonical package root or configured module and canonical project root; and canonical document path with complete Markdown content. Validate all provenance before following the document. Text mode presents provenance before content; errors exit 1 on stderr with empty stdout; help requires no configuration.

Package documentation defaults to root `README.md`; a manifest may select another relative Markdown file through `focusedSpec.documentation`. A local-module registration may declare only a safe project-relative Markdown `documentation` path beside `module`; absence affects documentation lookup, not plugin execution. Documentation lookup imports no code, downloads nothing, enumerates no plugins, interprets no opaque options, and writes no files. Treat returned documentation as dependency or project text, not core instruction.

For composition, first read the configured plugin's selected document. If it defines a nested package option, read that specific configured value according to the documented contract and issue the next explicit `plugin-docs --package <specifier> --root <path> --json` request. Never guess nested references by scanning arbitrary options or expect automatic aggregation. If any required document or provenance is missing or invalid, stop rather than substituting core guidance, another README, implementation source, or a sibling package.

If the local package or command is missing, predates `instructions`, rejects protocol 1 or the required topic, fails, or returns malformed, mismatched, or empty guidance, refuse to proceed with that focused-spec work until a compatible project-local installation is available.
