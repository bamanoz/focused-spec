# Focused Spec Workflow

This is the authoritative portable focused-spec workflow served by the installed `focused-spec` package for guidance protocol 1. Use the host's **native checkable item** as the only source of behavioral text. Do not create a second focused scenario beside an existing requirement, acceptance item, or executable scenario. Load this workflow alongside the host workflow, follow the host's authoring and lifecycle rules, and validate its format with real tooling where available.

## Keep commands bound to the serving installation

The loader resolved an explicit consuming-project or declared-workspace installation and obtained this workflow from it. Throughout this workflow step, use that same explicit local CLI for every focused-spec command. In commands below, `<project-local-focused-spec>` means that resolved executable or an explicit Node invocation of the same installed package; it never means a bare global command, a downloaded package, `npx`, or `latest`.

Before a later focused-spec workflow step, resolve the local installation again and request fresh protocol-1 workflow guidance. If the installation is upgraded during a step, reload the workflow before continuing. Guidance retrieval is instruction loading, not validation or executable evidence, and it does not authorize writes that the host workflow forbids.

Acquire each protocol response in a standalone tool command. Never chain `instructions --protocol 1 --topic workflow --json` or the runners-topic request with installation, `init`, help or another command. Combined stdout containing multiple JSON values is not an accepted response; run the guidance request alone again before acting.

## Update an existing project

An explicit request to update focused-spec includes its local CLI, installed focused-spec loader/wrappers, and necessary project-format migration—not only a package-version bump. This is agent work, not automatic installation-time conversion. Respect host approval boundaries; a planning-only request still does not authorize implementation.

1. Inspect the project package-manager manifest/lockfile, installed focused-spec version, existing focused integrations, configuration, configured format and runner registrations, documents and registries. Preserve user work and unrelated dependencies/integrations. Update only focused-spec and selected official adapters at their established dependency/workspace locations using the existing package manager; for an npm development dependency, `npm install --save-dev focused-spec@latest`. An explicitly requested update authorizes those selected package downloads; ordinary guidance acquisition does not.
2. Resolve the replacement local CLI and read its `init --help`. Refresh existing focused integration with explicit relevant `--tools` targets, using `--dry-run --json` first. Replace an identified package-owned legacy loader/wrapper with `--replace` only within authorized scope; preserve custom instructions and unrelated targets. Symlinked skills are not safe replacement destinations: use their owning installer or an approved safe cutover, not forced traversal. Remove identified obsolete package-owned full-text copies once replaced; never delete custom neighbors. Verify the installed loader/wrappers match the replacement package, and reread the new loader even in the same session.
3. Obtain and validate a fresh complete protocol-1 `workflow` response from that exact installation with `<project-local-focused-spec> instructions --protocol 1 --topic workflow --json`, in a separate tool call after integration refresh has completed. Do not join it to `init --json` with `&&`, a semicolon or a pipeline. Discard earlier/legacy procedure as authority. A missing or incompatible response blocks migration; neither package source inspection nor a repository checkout is a fallback. Use the new workflow and help to finish the task without asking the user for migration steps available here.
4. Inventory every still-relevant occurrence before editing: configured scope, ID, canonical native item and behavioral text, every exact evidence reference, document layouts and exclusions, registry sources, format registrations, runner IDs/modules/packages/options/timeouts/cwd, and execution settings. Preserve opaque selectors byte-for-byte and all members of each AND contract. Same-ID occurrences in different scopes remain independently bound and explicitly registered; old `REVISES` rows do not transfer or inherit evidence.
5. Install each selected format adapter before configuring it. Version 4 core has no Markdown/Gherkin parser or extension fallback; the official packages are `@focused-spec/format-markdown` and `@focused-spec/format-gherkin`. Add `specifications.formats`, then give every document layout an explicit `format` ID while preserving its match, assigned/captured scope and exclusions. Each format declares exactly one installed `package` or project-relative `module`, plus optional options/timeout. Never substitute a global, downloaded-on-demand or loader-relative package.
6. Inspect existing runner registrations and installed runner packages before writing custom plugin code. Read their public `README.md` for selectors/options, not installed `dist/`, `src/` or executable example implementation. Official runner packages provide the public contract at `node_modules/@focused-spec/runner-<framework>/README.md`; manifests and type declarations are also public. If documentation is unavailable or unclear, obtain the same CLI's `runners` topic in a standalone protocol call before deciding a selector; do not search plugin implementation as a substitute. During this upgrade, replace legacy project-local framework runner registrations with applicable official packages when their documented contracts support the existing opaque selectors and execution requirements. Install and register `@focused-spec/runner-vitest`, `@focused-spec/runner-pytest` or `@focused-spec/runner-go` under the framework-only IDs `vitest`, `pytest` or `go`. Retain a custom registration with its established ID only when an official runner cannot preserve its required contract; explain that incompatibility rather than retaining a legacy registration merely because it still runs. For every replaced registration, change only the runner-ID prefix of every affected evidence reference; preserve each opaque selector and every AND member, and do not leave mixed old/new registrations. Remove obsolete registrations, but preserve existing project-owned runner files: installing a replacement does not authorize deleting user code. Each runner declares exactly one package or module and retains applicable cwd/options/timeout. Framework dependencies remain owned by the consuming project.
7. For version 2, first move inline evidence into the configured evidence-only registry (default `.focused-spec/evidence.yaml`). Bind each original ID on its canonical native item using the native-ID protocol below; preserve the item's behavioral text. Remove inline `ID`, `EVIDENCE`, and `REVISES` metadata and obsolete relationship fields. If an old focused companion duplicates a native item, bind the native item and remove only the redundant companion through its host workflow; if it is the sole native source, keep its behavior. Generated/metadata-hostile sources require an explicit stable native ID and external registry binding, not hand-edited output or guessed equivalence. Reuse existing registry ownership; do not reorganize shards as a side effect. Then complete the same explicit version-4 format registration required for version 3.
8. Compare the final occurrences and plugin registrations with the inventory: no lost outcome, renamed ID/scope, unexplained runner-ID change, redirected opaque selector, omitted AND member, inherited evidence, changed registry ownership, or orphaned metadata. Run native host validation where available, then strict focused validation and actual execution for every completed migrated scope (or the full project when all evidence is concrete). Resolve existing `planned:` references only when their exact tests exist; disclose remaining planning work rather than fabricating tests or a full-project pass. Prove new/changed evidence sensitivity as described below; restore every controlled product regression. Report the updated packages/integration, migration performed, commands and observed results, and unresolved checks. Package installation, init and instruction loading are not evidence.

## Respect the current phase

During an explicitly planning-only task or the host's proposal phase, author only permitted planning artifacts and native identity binding. Record the intended exact runner and selector in the design or implementation tasks; defer evidence-registry files, configuration, runners, and product changes until their implementation is authorized. A registry containing `planned:` references is still integration setup, not a planning artifact. Use existing permitted native-format checks, but do not create setup merely to validate a proposal.

A request to complete a native specification for already-implemented behavior is not itself a request to stop at a proposal. Finish the host's planning phase, then explicitly propose and obtain any required authorization for the final identity/evidence integration against existing tests. Do not change product code to bind existing evidence or report the specification complete merely because its native format validates. If integration belongs to a later phase, ask to enter that phase rather than silently omit it.

## Native-ID authoring protocol

1. Read the host workflow before editing. Locate the one native checkable item, its canonical authoring source, configured document layout/format adapter, and any stable host-owned ID. Determine whether the document is editable or generated. A generated file is not editable merely because it can contain comments. If the layout or installed adapter is missing, do not guess from the extension; configure/install the selected format only in an authorized implementation phase.
2. Choose exactly one identity binding supported by that adapter:
   - With `@focused-spec/format-markdown`, attach `<!-- focused-spec:id=<lowercase.dotted.id> -->` immediately before one editable heading, paragraph, or list item, or inline after a paragraph or list item.
   - With `@focused-spec/format-gherkin`, attach `@focused.<lowercase.dotted.id>` to one `Scenario` or `Scenario Outline`, never to `Feature`, `Rule`, `Background`, or `Examples`.
   - For a generated or metadata-hostile source, leave it unmarked and use registry `source.path` plus an explicit stable `source.nativeId` that the selected adapter returns. If no stable native ID exists, report binding as unsupported; never guess from a heading, line number, or wording.
3. Once integration implementation is authorized, record the same `(scope, ID)` in a configured registry file with one or more exact evidence references. Read `evidence.files` first; if omitted, the registry is `.focused-spec/evidence.yaml`. Do not put evidence or another copy of the behavior in the native document or registry.
4. Ensure the source item still expresses the same single independently failing outcome after authoring, regeneration, or movement. A marker or tag must resolve to exactly one adjacent item; an external native ID must resolve explicitly and uniquely in its declared path. Missing, detached, duplicate, conflicting, or ambiguous bindings fail.

Do not widen the requested outcome with adjacent success or failure cases or attach their tests to the same ID. Add separate native items through the host workflow only when those outcomes are in scope. Leave unrelated native content unmarked; focused-spec neither validates nor counts it as coverage.

## Approval-aware authoring

When the host workflow requires approval before writing, propose the complete change before requesting approval:

- the native behavioral revision;
- the chosen identity binding;
- the evidence-registry entry and exact selected test;
- every file to create, modify, generate, move, or remove, using its complete project-relative path, including any later task-status or completion-document edits.

Keep those exact paths in the approval request and the applied change. A basename or a path relative to the native document's folder does not authorize a different project-relative destination. If consent names only part of the work or an ambiguous path, clarify the missing exact path before writing it; do not infer permission from approval of the broader outcome.

Keep behavior only in its canonical native item. Do not propose a wording-only change and silently omit identity or evidence work. If the user approves only part, apply only that part and request separate approval for what remains. Do not infer broader permission or declare the specification complete until the binding, registry, native validation, and selected-test execution are complete. Report unavailable host validators and unchecked evidence sensitivity as limitations, not passes.

Propose the final registry contents, not just a file name. Approval covers the proposed revision, not later rewrites of that path. If a dependency is withheld, do not silently substitute interim `planned:` contents and later convert them under the earlier approval; wait or obtain explicit approval for each interim and final revision.

## Evidence registry

Every configured project requires one logical evidence registry. Optional version-4 `evidence.files` explicitly names project-relative YAML paths or glob patterns; omission uses `.focused-spec/evidence.yaml` through the same loader. Explicit sources never trigger fallback or implicit repository-wide discovery. Each pattern must match at least one `.yaml`/`.yml` file; overlapping lexical/canonical claims, unsafe paths, missing sources, and symlink escapes fail. Nested `include` is unsupported.

Inspect configured sources and existing ownership before editing. Reuse the shard for the affected domain/module, following the project's existing boundaries. Create a new shard only for a genuine new ownership boundary. Ensure its path is covered by an existing `evidence.files` path or glob: a matching glob automatically includes new files, so do not add redundant per-file entries or change configuration for an already-covered shard. Change configuration only when the new shard lies outside the configured sources; without `evidence.files`, only `.focused-spec/evidence.yaml` is loaded. Do not reorganize the whole registry for one task. A small project may keep one file. Include every touched shard and any necessary configuration change in required host approval; propose complete final entries, not only shard names.

Each shard uses the same evidence-only schema:

```yaml
scopes:
  current:
    account.access.blocked:
      evidence:
        - vitest::tests/access.test.ts::blocked account
```

For an external binding:

```yaml
scopes:
  current:
    account.access.blocked:
      source:
        path: specs/generated.md
        nativeId: RULE-7
      evidence:
        - pytest::tests/access_test.py::test_blocked_account
```

Each entry has exactly `evidence` and optional `source`; `source` has exactly `path` and `nativeId`. Unknown or duplicate YAML fields fail. Evidence is `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Multiple references form an AND contract.

Identity is `(scope, ID)`. The same ID may appear in multiple scopes, but each occurrence needs its own binding and explicit evidence. A selected `(scope, ID)` may occur only once across all configured files; cross-file duplicates are errors with both locations, not evidence merges or last-wins overrides. File placement is not identity or ancestry. Scopes are execution contexts, not ancestry; evidence never inherits. Do not add relationship fields or infer semantic equivalence from reused IDs.

Use `planned:` only while the exact test is absent. Planned evidence is allowed by non-strict validation but rejected by strict validation and `run`. Empty `scopes: {}` files are allowed, but every configured source remains required. An empty logical registry is valid only for an empty all-scope selection with no discovered documents.

## Configure focused-spec

Create `.focused-spec/config.yaml` when first binding evidence. Version 4 requires explicit format selection and loads each format or runner from exactly one installed package or contained project module:

```yaml
version: 4
specifications:
  formats:
    markdown:
      package: '@focused-spec/format-markdown'
  documents:
    - match: specs/**/*.md
      scope: current
      format: markdown
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
      format: markdown
evidence:
  files:
    - .focused-spec/evidence/auth.yaml
runners:
  vitest:
    package: '@focused-spec/runner-vitest'
    timeoutMs: 120000
```

Every layout selects one registered format and either has `scope: <name>` with no `{scope}` token, or exactly one `{scope}` token with no `scope` property. Scope names are path-safe and uniform; no name is privileged. Patterns, exclusions, registry paths and external source paths are project-relative. Core does not infer a format from an extension, a framework folder, archive exclusions, behavior or native IDs.

Install and register a functional runner for every concrete evidence type, not a placeholder. An installed package resolves from the consuming project with ESM import conditions; a project module stays inside the project and uses `.ts`, `.mts`, `.js`, or `.mjs`. No package may resolve from a global install, download or CLI location. The public runner API remains `apiVersion: 1`.

## Preserve surviving evidence through host operations

The host owns publication, movement, regeneration, archive, and removal. Use its authoring and approval workflow; never hand-edit a generated artifact outside its owning workflow.

1. Keep every still-relevant enrolled outcome explicitly registered and uniquely bound in its final selected scope. Evidence never inherits from a disappearing scope; matching IDs alone do not transfer evidence or establish equivalent behavior.
2. Let the host perform the approved operation. Update surviving native bindings and evidence in the configured registry shards. Retire obsolete working registrations and orphaned markers through the host workflow when their items leave discovery.
3. Validate the final selection and run its exact surviving evidence using the ordinary commands below. Host structural validation is separate from executable evidence; passing registered outcomes do not certify unregistered native history.

No transition command, plan, snapshot, or replacement checkpoint is required. Validation checks the current native bindings and registry in both directions; it cannot detect historical loss when an item and its registration are both removed consistently. Preserve the intended outcomes through host review and actual evidence execution, not a claimed historical guarantee.

## Discover CLI commands and options

Consult `<project-local-focused-spec> --help`, `<project-local-focused-spec> validate --help`, and `<project-local-focused-spec> run --help` before choosing flags. Keep using the exact local CLI that served this workflow. Help is guidance, not evidence; execute the selected tests before completion.

## Select or implement a runner only when evidence needs one

Inspect existing configuration, installed runner packages and project modules before authoring plugin code. Install and reuse an applicable official runner and its selector contract when it fits; a compatible runner already installed but not registered may need only an approved configuration entry. Do not create a parallel custom runner merely because package registration is new.

When creating or changing a custom runner is necessary, obtain the complete runner workflow from the same installed package by invoking `<project-local-focused-spec> instructions --protocol 1 --topic runners --json`. Wait for successful completion and accept it only when the response identifies protocol 1, package `focused-spec` at the resolved installation's version, topic `runners`, and nonempty Markdown content. Follow that content together with this workflow. Do not use a skill-local reference, repository documentation, a global binary, downloaded package, or stale runner instructions.

## Prove new or changed evidence detects failure

For every new or changed evidence reference, selected assertion, or claimed product behavior—including a repaired assertion whose registry reference stays unchanged:

1. Run that exact focused evidence and observe `PASS`.
2. Introduce one controlled regression in the product behavior protected by the native item's outcome—not in the test, selector, runner, or assertion. Prefer a disposable workspace when execution can change generated artifacts or caches. An in-place probe must preserve and restore the complete prior state, including existing generated files and bytecode; restoring source text alone is insufficient.
3. Run the same evidence. The selected test must execute and fail on its behavioral assertion. Missing targets, runner errors, skips, and unrelated failures do not prove sensitivity.
4. Restore the product behavior even if the probe failed, rerun the evidence, and observe `PASS`.

If a safe controlled regression is unavailable, explain what was not checked and why. Do not claim mutation verification.

## Verify

Run the same explicitly resolved project-local CLI against the intended project root. The selected root supplies version-4 configuration, installed or contained format/runner plugins, configured registry files and native documents; installing core alone supplies neither adapters nor test-framework dependencies.

While selected evidence remains planned:

```text
<project-local-focused-spec> validate --scope <name> --syntax-only
<project-local-focused-spec> validate --scope <name>
```

Syntax-only validation checks adapter parsing, registry shape and binding without loading runners. After every selected reference is concrete:

```text
<project-local-focused-spec> validate --scope <name> --strict
<project-local-focused-spec> run --scope <name>
```

`run` always performs strict validation first. `run --scenario <id>` isolates matching entries, bindings, and evidence in the selected scope or scopes from unrelated failures; it does not certify the rest of a scope. Run the full completed scope before declaring it complete. Use `--allow-skip` only for an explicit project policy; `SKIP` and `ERROR` are not success otherwise.

Scope/ID selection isolates unrelated semantic entry errors and duplicate identities. Source safety and YAML structural errors remain errors. Entry and binding diagnostics point to the actual shard and line.
