# @focused-spec/format-markdown

Structural Markdown parser for focused-spec Format API 2. Requires Node.js 22.16.0+ and a project-local `focused-spec` installation. It exposes native items and identities; it does not read evidence, implement a catalog binder, or interpret inline `ID`/`EVIDENCE` scenarios. No parser-specific options are required.

## Registry composition

Install the selected parser, evidence adapter, and runner explicitly:

```sh
npm install --save-dev focused-spec @focused-spec/format-markdown @focused-spec/format-registry @focused-spec/runner-go
```

`.focused-spec/config.yaml`:

```yaml
version: 5
specifications:
  formats:
    markdown:
      package: '@focused-spec/format-registry'
      options:
        parser: { package: '@focused-spec/format-markdown' }
  documents:
    - { match: 'specs/**/*.md', scope: current, format: markdown }
runners:
  go: { package: '@focused-spec/runner-go' }
```

`specs/auth.md`:

```markdown
<!-- focused-spec:id=auth-login -->
#### Scenario: Blocked account submits valid credentials
- **WHEN** a blocked account submits valid credentials
- **THEN** authentication is rejected
```

`.focused-spec/evidence.yaml`:

```yaml
scopes:
  current:
    auth-login:
      evidence:
        - planned:go::./auth::TestBlockedAccount
```

The registry adapter owns that evidence file and its default location. Read its installed `README.md` for explicit source lists, sharding, source safety, and external bindings. Read the selected runner's installed `README.md` for selectors. The planned reference above permits non-strict validation while the exact test is absent; it cannot execute. Once the real test exists, remove `planned:`, validate strictly, and run the evidence.

## Focused markers

A marker is `<!-- focused-spec:id=<id> -->`. Place it immediately before one heading, paragraph, or list item, allowing at most one blank line, or at the end of a paragraph or complete list item. An inline marker on a heading, text after an inline marker, detached markers, and multiple markers for one item fail. Markers inside fenced or indented code remain literal examples.

IDs are exact opaque values containing non-whitespace and no control characters. This marker syntax additionally excludes whitespace and `>` inside the ID; do not rename an existing ID to fit it. Choose another supported representation if needed. A marked item must have nonempty native text and receive exactly one evidence enrollment from a configured binder.

Inline `ID`, `EVIDENCE`, and `REVISES` list metadata is not this parser's dialect. To retain supported inline scenario authoring, explicitly select `@focused-spec/format-inline` instead. `REVISES` does not create identity ancestry or inherited evidence.

## Native IDs for external binding

The parser exposes explicit heading anchors such as `### Account limit {#RULE-7}`, or a leading bold/code ID such as `- **CAP-1**: Reject another item at the limit`. A leading ID is alphanumeric followed by alphanumerics, `_`, `.`, or `-`, and is followed by a colon or the end of the item. A heading's explicit anchor takes precedence over a leading ID. It does not invent IDs from heading slugs, line numbers, or behavioral wording.

For generated or metadata-hostile documents, leave the item unmarked and use the registry adapter's `source.path` plus `source.nativeId` binding. The native ID must resolve uniquely in that selected document and scope. Core preserves native source locations and owns scope-local uniqueness and execution; parsing Markdown is not proof that an outcome has executable evidence.

## Verification

Use the same project-local CLI that served the workflow:

```sh
npx focused-spec validate --syntax-only
npx focused-spec validate
```

After replacing every selected planned reference with an existing exact test:

```sh
npx focused-spec validate --strict
npx focused-spec run --scenario auth-login
```
