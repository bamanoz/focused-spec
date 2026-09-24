## Why

`focused-spec` currently treats `source: openspec` as both a file locator and a validation/execution model: hard-coded `specs/**/spec.md` paths ignore a project whose change spec lives at `spec.md`, while `source: files` cannot select a named change. Other SDD systems organize artifacts differently; users need to declare exactly where focused scenarios live without forcing the CLI to understand one framework's directory names or silently accepting misplaced files.

## What Changes

- Replace framework-named `specifications.source` modes with one explicit, project-local document layout: configured Markdown path patterns designate baseline documents or capture a named scope. Support specs beside planning artifacts as well as nested capability, feature, and spec directories; select a named scope independently of the framework.
- **BREAKING**: introduce configuration `version: 2` and replace `specifications.source` with declarative document layouts; replace `--change` with `--scope`. Migrate configuration, CLI result scope fields, agent skill, examples, repository configuration, eval fixtures, tests, and documentation without compatibility aliases.
- Make baseline revisions explicit in the focused scenario itself rather than inferring permission to reuse a stable ID from OpenSpec `MODIFIED`/`REMOVED` section headings. Preserve strict validation, planned evidence only in non-strict named scopes, complete-scope validation before selected execution, and unique target execution.
- Fail with an actionable diagnostic for a requested scope with no matching focused documents or ambiguous/overlapping matches. Do not automatically search another directory or treat zero matched documents in a selected scope as success.
- Keep the focused scenario language and project-local evidence runners framework-independent: non-conforming native SDD prose does not become executable evidence by inference. Projects may put focused scenarios inside their SDD Markdown or in an explicitly selected companion Markdown file; no mandatory discovery plugin or SDD CLI runtime dependency.

## Capabilities

### New Capabilities

None; the existing configuration, authoring, validation, and execution capabilities own this behavior.

### Modified Capabilities

- `project-configuration`: Replace framework-specific source discovery with configured baseline/named-scope document layouts and explicit missing/ambiguous source errors.
- `scenario-authoring`: Allow an explicit framework-neutral revision marker for an existing stable scenario ID; leave evidence and one-outcome requirements intact.
- `validation`: Apply repository-wide ownership and planned-evidence policy to baseline and named scopes without OpenSpec section-operation inference.
- `scenario-execution`: Select a named scope or baseline independently of framework, reporting validation and execution selections separately without false success on missing scopes.

## Impact

Implementation will change `src/config.ts`, `src/model.ts`, `src/sources.ts`, `src/parser.ts`, `src/validate.ts`, and `src/cli.ts`, plus affected tests, project `.focused-spec/config.yaml`, examples/eval fixtures, `skills/focused-spec/SKILL.md`, and their owning docs. The OpenSpec planning delta uses the normal schema directory only because this repository itself uses OpenSpec; it does not impose that layout on `focused-spec` consumers. Proposal creation is planning-only: no product, runner, or test code changes in this turn.
