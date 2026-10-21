# @focused-spec/format-inline

Explicit inline Markdown authoring for focused-spec Format API 2. Requires Node.js 22.16.0+ and a project-local `focused-spec` installation. It does not read or generate an evidence registry.

```yaml
version: 5
specifications:
  formats:
    inline: { package: '@focused-spec/format-inline' }
  documents:
    - { match: 'specs/**/*.md', scope: current, format: inline }
runners:
  go: { package: '@focused-spec/runner-go' }
  pytest: { package: '@focused-spec/runner-pytest' }
```

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth-login`
- **EVIDENCE**: `go::./auth::TestBlockedAccount`
- **EVIDENCE**: `pytest::tests/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits valid credentials
- **THEN** authentication is rejected
```

A level-four `Scenario:` heading owns metadata until the next heading at level four or above. Exactly one ID, WHEN and THEN and at least one EVIDENCE row are required. ID/EVIDENCE values must be individually backticked. Duplicate, malformed, missing or detached metadata fails validation; errors retain the real metadata line, including the second member of an AND contract. REVISES is unsupported: identities have no ancestry or inherited evidence.

IDs preserve exact case and value; nonblank strings without control characters are valid. No lowercase/dotted restriction or implicit path semantics. A format's Markdown representation must still be valid. Reference selectors stay opaque to core; only the first `::` separates the runner ID. Multiple EVIDENCE rows form AND: all must pass. Fenced/indented code and quoted examples never enroll scenarios. Plain unrelated content remains unenrolled.

## Planning before executable enrollment

When the current phase permits native identity but forbids executable integration, reserve the future inline ID with a structural Markdown marker immediately before its native scenario heading:

```markdown
<!-- focused-spec:id=auth-login -->
#### Scenario: Blocked account submits valid credentials
- **WHEN** a blocked account submits valid credentials
- **THEN** authentication is rejected
```

This uses the structural marker from `@focused-spec/format-markdown`, not executable inline metadata. Keep it adjacent to one item; do not create configuration, a registry, or incomplete inline ID/EVIDENCE rows merely to validate a proposal. Record intended exact evidence and final inline metadata in permitted planning artifacts instead. The example is not yet a valid executable inline scenario.

During authorized implementation, replace that marker with the inline ID row using the exact same value, add every required EVIDENCE row, and retain the canonical scenario and its WHEN/THEN. Do not leave a second identity representation or registry enrollment for the same item.

## Execute inline scenarios

Use the project's installed CLI to validate and execute:

```sh
npx focused-spec validate --syntax-only
npx focused-spec validate --strict
npx focused-spec run --scenario auth-login
```

`planned:` references are accepted only during non-strict validation and never claim executed targets. Syntax-only does not import runners. Each scope occurrence declares its own evidence; duplicates in one scope or a second external enrollment of the same native item fail rather than merge.

Selection is explicit: `@focused-spec/format-markdown` remains a structural parser, not an implicit inline reader. Format code runs in the CLI's bounded trusted plugin host, not a security sandbox. Core owns document scope/path and validation/execution, while this adapter owns authoring grammar and exact per-reference source locations.
