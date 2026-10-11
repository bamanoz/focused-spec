# Focused Spec Workflow

This is the authoritative portable focused-spec workflow served by the installed `focused-spec` package for guidance protocol 1. Use the host's **native checkable item** as the only source of behavioral text. Do not create a second focused scenario beside an existing requirement, acceptance item, or executable scenario. Load this workflow alongside the host workflow, follow the host's authoring and lifecycle rules, and validate its format with real tooling where available.

## Keep commands bound to the serving installation

The loader resolved an explicit consuming-project or declared-workspace installation and obtained this workflow from it. Throughout this workflow step, use that same explicit local CLI for every focused-spec command. In commands below, `<project-local-focused-spec>` means that resolved executable or an explicit Node invocation of the same installed package; it never means a bare global command, a downloaded package, `npx`, or `latest`.

Before a later focused-spec workflow step, resolve the local installation again and request fresh protocol-1 workflow guidance. If the installation is upgraded during a step, reload the workflow before continuing. Guidance retrieval is instruction loading, not validation or executable evidence, and it does not authorize writes that the host workflow forbids.

## Respect the current phase

During an explicitly planning-only task or the host's proposal phase, author only permitted planning artifacts and native identity binding. Record the intended exact runner and selector in the design or implementation tasks; defer evidence-registry files, configuration, runners, and product changes until their implementation is authorized. A registry containing `planned:` references is still integration setup, not a planning artifact. Use existing permitted native-format checks, but do not create setup merely to validate a proposal.

A request to complete a native specification for already-implemented behavior is not itself a request to stop at a proposal. Finish the host's planning phase, then explicitly propose and obtain any required authorization for the final identity/evidence integration against existing tests. Do not change product code to bind existing evidence or report the specification complete merely because its native format validates. If integration belongs to a later phase, ask to enter that phase rather than silently omit it.

## Native-ID authoring protocol

1. Read the host workflow before editing. Locate the one native checkable item, its canonical authoring source, and any stable host-owned ID. Determine whether the document is editable or generated. A generated file is not editable merely because it can contain comments.
2. Choose exactly one identity binding:
   - Editable Markdown: attach `<!-- focused-spec:id=<lowercase.dotted.id> -->` immediately before one heading, paragraph, or list item, or inline after a paragraph or list item.
   - Gherkin: attach `@focused.<lowercase.dotted.id>` to one `Scenario` or `Scenario Outline`, never to `Feature`, `Rule`, `Background`, or `Examples`.
   - Generated or metadata-hostile source: leave it unmarked and use registry `source.path` plus an explicit stable `source.nativeId`. If no stable native ID exists, report binding as unsupported; never guess from a heading, line number, or wording.
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

Every configured project requires one logical evidence registry. Optional version-3 `evidence.files` explicitly names project-relative YAML paths or glob patterns; omission uses `.focused-spec/evidence.yaml` through the same loader. Explicit sources never trigger fallback or implicit repository-wide discovery. Each pattern must match at least one `.yaml`/`.yml` file; overlapping lexical/canonical claims, unsafe paths, missing sources, and symlink escapes fail. Nested `include` is unsupported.

Inspect configured sources and existing ownership before editing. Reuse the shard for the affected domain/module, following the project's existing boundaries. Create a new shard only for a genuine new ownership boundary. Ensure its path is covered by an existing `evidence.files` path or glob: a matching glob automatically includes new files, so do not add redundant per-file entries or change configuration for an already-covered shard. Change configuration only when the new shard lies outside the configured sources; without `evidence.files`, only `.focused-spec/evidence.yaml` is loaded. Do not reorganize the whole registry for one task. A small project may keep one file. Include every touched shard and any necessary configuration change in required host approval; propose complete final entries, not only shard names.

Each shard uses the same evidence-only schema:

```yaml
scopes:
  current:
    account.access.blocked:
      evidence:
        - project-tests::tests/access.test.ts::blocked-account
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
        - project-tests::tests/access.test.ts::blocked-account
```

Each entry has exactly `evidence` and optional `source`; `source` has exactly `path` and `nativeId`. Unknown or duplicate YAML fields fail. Evidence is `[planned:]<runner-id>::<opaque selector>`; only the first `::` separates the runner ID. Multiple references form an AND contract.

Identity is `(scope, ID)`. The same ID may appear in multiple scopes, but each occurrence needs its own binding and explicit evidence. A selected `(scope, ID)` may occur only once across all configured files; cross-file duplicates are errors with both locations, not evidence merges or last-wins overrides. File placement is not identity or ancestry. Scopes are execution contexts, not ancestry; evidence never inherits. Do not add relationship fields or infer semantic equivalence from reused IDs.

Use `planned:` only while the exact test is absent. Planned evidence is allowed by non-strict validation but rejected by strict validation and `run`. Empty `scopes: {}` files are allowed, but every configured source remains required. An empty logical registry is valid only for an empty all-scope selection with no discovered documents.

## Configure focused-spec

Create `.focused-spec/config.yaml` when first binding evidence. Version 3 keeps explicit fixed and captured document layouts and the existing runner configuration:

```yaml
version: 3
specifications:
  documents:
    - match: specs/**/*.{md,feature}
      scope: current
      exclude: [specs/archive/**]
    - match: changes/{scope}/spec.md
evidence:
  files:
    - .focused-spec/evidence/auth.yaml
runners:
  project-tests:
    module: ./.focused-spec/runners/project-tests.ts
    timeoutMs: 120000
```

Every layout either has `scope: <name>` and no `{scope}` token, or exactly one `{scope}` token and no `scope` property. Documents must be `.md` or `.feature`. Scope names are path-safe and uniform; no name is privileged. Patterns, exclusions, registry paths, and external source paths are project-relative. The CLI does not infer framework folders, archive exclusions, behavior, or native IDs.

Register a functional runner for every concrete evidence type, not a placeholder. A runner module stays inside the project and uses `.ts`, `.mts`, `.js`, or `.mjs`. The public runner API remains `apiVersion: 1`.

## Preserve surviving evidence through host operations

The host owns publication, movement, regeneration, archive, and removal. Use its authoring and approval workflow; never hand-edit a generated artifact outside its owning workflow.

1. Keep every still-relevant enrolled outcome explicitly registered and uniquely bound in its final selected scope. Evidence never inherits from a disappearing scope; matching IDs alone do not transfer evidence or establish equivalent behavior.
2. Let the host perform the approved operation. Update surviving native bindings and evidence in the configured registry shards. Retire obsolete working registrations and orphaned markers through the host workflow when their items leave discovery.
3. Validate the final selection and run its exact surviving evidence using the ordinary commands below. Host structural validation is separate from executable evidence; passing registered outcomes do not certify unregistered native history.

No transition command, plan, snapshot, or replacement checkpoint is required. Validation checks the current native bindings and registry in both directions; it cannot detect historical loss when an item and its registration are both removed consistently. Preserve the intended outcomes through host review and actual evidence execution, not a claimed historical guarantee.

## Discover CLI commands and options

Consult `<project-local-focused-spec> --help`, `<project-local-focused-spec> validate --help`, and `<project-local-focused-spec> run --help` before choosing flags. Keep using the exact local CLI that served this workflow. Help is guidance, not evidence; execute the selected tests before completion.

## Implement a runner only when evidence needs one

When creating or changing a runner, obtain the complete runner workflow from the same installed package by invoking `<project-local-focused-spec> instructions --protocol 1 --topic runners --json`. Wait for successful completion and accept it only when the response identifies protocol 1, package `focused-spec` at the resolved installation's version, topic `runners`, and nonempty Markdown content. Follow that content together with this workflow. Do not use a skill-local reference, repository documentation, a global binary, or stale runner instructions.

Inspect existing configuration and project-local runner modules first. Reuse an applicable runner and its selector contract rather than creating another or overwriting it. A runner already present but not yet registered may need only an approved configuration entry.

## Prove new or changed evidence detects failure

For every new or changed evidence reference, selected assertion, or claimed product behavior—including a repaired assertion whose registry reference stays unchanged:

1. Run that exact focused evidence and observe `PASS`.
2. In a disposable workspace or with a reversible change that preserves user work, introduce one controlled regression in the product behavior protected by the native item's outcome—not in the test, selector, runner, or assertion.
3. Run the same evidence. The selected test must execute and fail on its behavioral assertion. Missing targets, runner errors, skips, and unrelated failures do not prove sensitivity.
4. Restore the product behavior even if the probe failed, rerun the evidence, and observe `PASS`.

If a safe controlled regression is unavailable, explain what was not checked and why. Do not claim mutation verification.

## Verify

Run the same explicitly resolved project-local CLI against the intended project root. The selected root supplies version-3 configuration, its configured registry files, native documents, and project-local runners; installing the CLI alone supplies neither test dependencies nor runners.

While selected evidence remains planned:

```text
<project-local-focused-spec> validate --scope <name> --syntax-only
<project-local-focused-spec> validate --scope <name>
```

Syntax-only validation checks native parsing, registry shape, and binding without loading runners. After every selected reference is concrete:

```text
<project-local-focused-spec> validate --scope <name> --strict
<project-local-focused-spec> run --scope <name>
```

`run` always performs strict validation first. `run --scenario <id>` isolates matching entries, bindings, and evidence in the selected scope or scopes from unrelated failures; it does not certify the rest of a scope. Run the full completed scope before declaring it complete. Use `--allow-skip` only for an explicit project policy; `SKIP` and `ERROR` are not success otherwise.

Scope/ID selection isolates unrelated semantic entry errors and duplicate identities. Source safety and YAML structural errors remain errors. Entry and binding diagnostics point to the actual shard and line.
