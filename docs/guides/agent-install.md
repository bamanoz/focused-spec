# Install focused-spec with an AI agent

This page is for a coding agent asked to install focused-spec **in a consuming project**. Install the local CLI and integration for the agent doing BDD or SDD work; verify the result, then hand off to the installed loader. The user continues their normal work afterward; loading the skill and invoking the CLI are the agent's responsibility, not commands the user must remember. You do not need this repository's source code to install it.

Installation is not specification authoring or evidence verification. Do not create specifications, rewrite native requirements, register plugins, or migrate existing evidence merely to make installation look complete. If the user also requested project integration, continue that authorized work through the installed skill after setup.

For manual options, see the [installation guide](install.md). Exact flags, target IDs, destinations, and safety rules belong to the [CLI reference](../reference/cli.md#agent-initialization).

## 1. Establish the project and installation owner

- Identify the consuming project root from the user's request and repository/package context. `init` uses its explicit directory or cwd; it does not search ancestors or create a missing project.
- Inspect the existing package manifest, package-manager declaration, lockfile, workspace structure, focused-spec dependencies, and selected agent integration. Preserve unrelated changes and customized instructions.
- Use the project's package manager and dependency-owning workspace. Do not introduce a competing lockfile or install into every workspace package. If there is no package manifest or the ownership is genuinely unclear, resolve that choice with the user before creating one.
- Check the runtime:

  ```sh
  node --version
  ```

  focused-spec requires **Node.js 22.16.0+**. If unavailable, report the missing prerequisite; do not silently install Node, change the user's version manager, or edit shell startup files.
- Choose only the agent target or targets requested or established by the current working agent. Existing directories are clues, not permission to install every detected integration. Ask if the intended authoring agent is unknown. Use the installed `init --help` and the linked target catalog, not another installer's IDs: bundled Claude Code is `claude`, not `claude-code`.

If focused-spec is already installed, identify its local version and preserve its current setup. An explicit upgrade request includes package/integration refresh and migration through the replacement loader's upgrade procedure; rerunning `init` alone is not a migration. Do not silently turn a fresh-install request into a destructive upgrade.

## 2. Install the local CLI

For an npm project, in the dependency-owning directory:

```sh
npm install --save-dev focused-spec
```

Use the equivalent local development-dependency operation for the project's existing package manager. Do not install globally, run a remote shell installer, or clone this repository as a consumer dependency. Go, Python, and .NET projects using the agent loader still need a project-local Node package installation for its CLI guidance; independent SDK execution itself needs neither that installation nor CLI plugins/configuration.

After installing the dependency, the bootstrap commands below use `npx --no-install focused-spec` from the dependency-owning directory. `--no-install` prevents npx from fetching a different package if the local CLI is absent.

```sh
npx --no-install focused-spec version --json
```

For a hoisted workspace, run npx in the established installation root and pass the intended project path to `init`. Do not fall back to a bare command on `PATH`, a global package, or downloading npx. On Windows, use the same local-only npx command in the project's shell.

Read the installed package manifest and compare the version response with that same installation: package name/version, canonical executable path, runtime, and supported contract versions. Stop if npx did not resolve that installation. A successful version command identifies the CLI; it does not validate project configuration or evidence. After installation, the skill resolves and invokes the explicit local executable itself; do not substitute npx for its workflow-guidance calls.

### Defer composition to the installed workflow

Core contains no document parser, evidence store or test runner. Do not select plugins from this installation page. Finish core/agent setup; for subsequent authorized specification work, load the installed skill and follow its workflow without waiting for a dedicated user invocation. When project integration is requested, that workflow acquires the same local CLI's `integration` topic before selecting packages, including a first SDK-only choice with no focused configuration or CLI plugins, then each selected installed package's public contract before configuration. SDK-only execution and optional CLI integration are distinct paths.

An installation-only task leaves plugin choice, configuration and evidence explicitly pending; do not invent a test stack or convert an existing source to finish setup.

## 3. Preview and initialize the chosen integration

Read the installed CLI's options first:

```sh
npx --no-install focused-spec init --help
```

The following example assumes **Claude Code was selected**. Replace `claude` with the intended target ID, or a comma-separated list. Execute preview and installation separately:

```sh
npx --no-install focused-spec init --tools claude --dry-run --json
```

Inspect the returned root, targets, paths, actions, and errors. Continue only if the plan matches the requested project and integrations:

```sh
npx --no-install focused-spec init --tools claude --json
```

- Always pass explicit `--tools` in agent automation: it bypasses the TTY picker, animation and confirmation prompt even when attached to a terminal. A human may instead run `init` without `--tools` to search, select and review actions before pressing Y; the [installation guide](install.md#bundled-agent-integration) explains those controls. No `all` or `none` target exists.
- A preview performs real conflict and safety checks but writes nothing; a conflict is a failure, not permission to bypass it.
- Do not add `--replace` automatically. Report customized selected files and obtain authorization before replacing them. Symlinked/unsafe destinations remain errors even with replacement.
- Targets are project-local **except `minimax-code`**, which writes the global home loader. Select it only when the user explicitly requests that global integration; preview its absolute destination first. Never infer home-directory permission from an existing directory.
- Init installs bundled loader assets and native wrappers where supported. It does **not** create configuration, evidence, specifications, runner registrations, global settings, or `AGENTS.md`.

## 4. Verify installation and skill discovery

Check the actual initialization result, not just its exit code:

- Root and target IDs match the requested project and authoring agent.
- Reported files exist at the returned destinations and contain the installed loader or wrapper. Read them; do not assume every host gets command files. Codex, for example, receives the shared `.agents/skills/focused-spec/SKILL.md` loader without a command wrapper.
- Report conflicts and partial writes honestly. A failed installation may have completed some writes; do not claim rollback.
- Check any host reload or external-directory configuration hint printed by init. Explain the normal handoff: the user continues BDD or SDD work, and the agent loads focused-spec when its description applies, alongside a host workflow when present. A native wrapper or explicit invocation is optional, not a required user step.

A loader on disk is discoverable, not necessarily loaded. Read the installed skill and description. It requires loading for executable-scenario and application-driver review, authoring, revision, and verification, including SDK-only work without an SDD framework or CLI integration, as well as SDD steps concerning behavioral requirements or scenarios—even when the user does not name focused-spec. Do not turn this agent obligation into a per-task user invocation. **The installed loader, not this page, owns subsequent guidance acquisition.** Follow a host workflow when present; installation alone authorizes no specification or evidence changes.

If the host cannot discover or load the installed skill in this session, report the precise discovery/reload/configuration limitation. Do not claim loading from file existence alone, promise automatic host compliance from `MUST-LOAD`, or silently modify the project's agent rules. Use the [discovery and troubleshooting guidance](install.md#skill-discovery-and-troubleshooting); explicit invocation may diagnose routing but does not replace the intended agent-owned loading.

## 5. Report the boundary reached

Return a short factual report:

- Project root, dependency owner, package-manager command, installed CLI version and executable.
- Selected plugins, target IDs, created/unchanged integration paths, and any conflicts or limitations.
- Whether skill discovery and an actual loader read were observed, whether current workflow guidance was acquired for any authorized specification work, and any remaining host discovery/reload limitation. Do not report required per-task user invocation as normal setup.
- Whether project configuration/evidence already exists, was integrated under separate authorization, or remains pending.

Do not run `validate` or `run` in an unconfigured project as an installation check. When configuration and evidence integration are also authorized, follow the installed workflow and [configuration guide](configuration.md), then execute the selected evidence. `validate --strict` resolves exact targets but does not run them; only actual execution supplies test results. Neither installation success nor an empty selection proves behavioral coverage.
