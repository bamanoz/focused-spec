# Upgrade Focused Spec

Use this topic for an explicit request to update focused-spec. An upgrade includes the selected CLI installation, package-owned loader or wrappers, and any necessary supported project-format migration; it is not only a version bump. Preserve unrelated dependencies, custom instructions, project-owned plugins, native behavior, and evidence ownership.

The focused-spec executable may be installed in the project, globally, or at an explicit path. The upgrade target is the installation and integration the user authorized. Do not replace another installation merely because it is easier to locate. Project configuration, documents, formats, runners, and plugin packages still resolve from the explicit consuming-project root, not from the CLI's installation directory.

## Respect phase and ownership

Inspect the host workflow and current authorization before mutation. A planning-only request records the exact package, integration, configuration, native, evidence, and test changes but does not implement them. Package download is authorized only by the explicit upgrade scope. Do not convert a general specification task into an update or use guidance acquisition as permission to install anything.

Use the project's established package manager and dependency owner for a project-owned installation. For a global or explicitly located installation, use its actual owner and supported update mechanism; do not create a project dependency solely to satisfy the loader. Preserve custom integration files and unrelated targets.

## Replace the selected installation and refresh integration

1. Inspect the selected CLI's version and package identity, its installation owner, project manifest and lockfile when applicable, installed focused-spec integrations, configuration, plugin registrations, documents, and evidence sources.
2. Update only the authorized focused-spec installation and selected compatible plugins. Do not alter unrelated dependencies, lockfiles, workspaces, or globally installed tools.
3. Resolve the replacement executable explicitly and read its `init --help`. Refresh existing package-owned integrations for explicit relevant `--tools` targets, using `--dry-run --json` first. Use `--replace` only for an identified package-owned legacy loader or wrapper within authorized scope. Preserve custom neighbors and unrelated targets. A symlinked destination requires its owning installer or an approved safe cutover, not forced traversal.
4. Verify the refreshed loader or wrapper comes from the replacement package and reread it. Remove only obsolete full-text copies known to be package-owned and replaced; never delete custom instructions.
5. Using that replacement executable, request `instructions --protocol 1 --topic workflow --json` as a standalone command. Do not combine it with installation, `init`, help, version checks, another topic, or another command. Follow the new router and acquire this `upgrade` topic from the same executable. Discard the earlier package's procedure as authority.

The loader and CLI can reside outside the project. Pass the consuming-project root only to commands that read project state or plugins; `instructions` has no project-root option. A missing or incompatible replacement guidance response blocks migration. Repository source, an old loader, another installed CLI, or downloaded instructions are not fallbacks.

## Inventory before migrating

Record every still-relevant occurrence and integration detail before editing:

- configured project root, scope, exact opaque ID, canonical native item, and behavioral text;
- every evidence reference, order, AND member, owning source, and provenance location;
- document matches, exclusions, explicit or captured scopes, selected formats, and options;
- runner IDs, packages or modules, options, timeouts, cwd, selectors, and execution settings;
- dependency locations, package versions, project-owned modules, and custom documentation;
- any historical `REVISES` metadata solely to preserve the surviving behavior and evidence before removal.

Same-ID occurrences in different scopes remain independent. `REVISES`, owners, file placement, and revision edges create no inheritance. If an old companion duplicates a native item, remove only the redundant companion through its host workflow. If it is the sole native source, preserve its behavior.

## Acquire every selected public contract

Before writing migrated configuration, obtain the shared `formats` topic and, when runner selection or repair is involved, the `runners` topic through the workflow router. Then request the complete installed public document for every selected format and runner using the replacement CLI with the explicit project root:

```text
<focused-spec-cli> plugin-docs --format <id> --root <project-root> --json
<focused-spec-cli> plugin-docs --runner <id> --root <project-root> --json
```

For a package being evaluated before registration, request:

```text
<focused-spec-cli> plugin-docs --package <specifier> --root <project-root> --json
```

Configured requests may add `--config <path>`; package lookup may not. Accept only the requested selection with matching installed package or contained project module, canonical root, and canonical complete Markdown document. Keep provenance visible and do not infer syntax, selectors, or options from implementation.

Composition requires explicit follow-up. Read the composing format's selected document first. If it defines a nested package option, read that specific configured value according to the document and make a separate `plugin-docs --package <specifier> --root <project-root> --json` request. Core does not inspect opaque options or aggregate nested documentation. Missing, mismatched, unsafe, or incomplete documents block the affected migration; another README or plugin is not a fallback.

## Migrate in one clean cutover

1. Install each selected compatible Format API 2 adapter and runner at the project's established dependency owner before registering it. Core provides no parser, registry, evidence loader, format inference, runner, or nested dependency discovery.
2. Move configuration to version 5. Register formats under `specifications.formats`, assign one explicit format to every document layout, and preserve each layout's match, exclusions, and fixed or captured scope. Formats and runners declare exactly one installed `package` or contained project `module`, plus their documented options and bounds.
3. Remove top-level `evidence`. Migrate its existing source list unchanged into the selected storage adapter's documented options. Supported historical inline `ID` and `EVIDENCE` may remain inline through an explicit compatible adapter; do not force them into YAML.
4. Preserve the existing authoring representation and evidence owner. Upgrading does not authorize conversion between inline, registry, generated, or code-native sources. Bind generated or metadata-hostile sources only through the selected format's documented stable native identity.
5. Remove every `REVISES` and obsolete relationship field after inventory, without renaming identity, dropping evidence, or inventing ancestry.
6. Preserve exact opaque IDs, scopes, selectors, AND members, runner IDs, storage shards, and domain owners. If an authorized runner replacement requires an ID change, update only affected reference prefixes and preserve each opaque selector suffix.
7. Preserve project-owned runner and format modules unless their replacement or removal is authorized. Do not create parallel custom plugins when a compatible registration exists.
8. Keep `execution.maxConcurrentGroups` at `1` unless the selected runner's grouping and actual shared resources have been audited through the runner topic.

## Compare and verify the migration

Compare the final project with the inventory in both directions. There must be no lost outcome, changed ID/scope/case, unexplained runner-ID change, redirected selector, omitted AND member, inherited evidence, changed storage or shard owner, duplicate enrollment, or orphaned metadata.

Run native host validation where available. Then acquire the `verify` topic and use the same replacement executable against the explicit project root. Perform strict focused validation and real execution for every completed migrated scope, or the full project when all evidence is concrete. Resolve `planned:` only when its exact test now exists. Prove new or changed evidence and assertions with the required baseline pass, controlled application regression failure, exact restoration, and restored pass.

Report the selected CLI installation and version, refreshed integration targets, updated packages, migrated owners/scopes/IDs, commands and observed results, and any exact limitation. A package update, valid configuration, or successful loader refresh alone does not complete the migration.