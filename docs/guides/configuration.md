# Configure and author

## Configuration

Create `.focused-spec/config.yaml` in the project root:

```yaml
version: 1
specifications:
  source: files
  paths:
    - specs/**/*.md
runners:
  go-unit:
    module: ./.focused-spec/runners/go-test.ts
    timeoutMs: 120000
  pytest-functional:
    module: ./.focused-spec/runners/pytest.ts
    timeoutMs: 120000
```

For OpenSpec-backed projects, use `source: openspec`; current specs and active change deltas are discovered by the CLI.

A runner ID names one execution environment. Runner modules are project-relative `.ts`, `.mts`, `.js`, or `.mjs` files.

## Scenario

```markdown
#### Scenario: Blocked account submits valid credentials
- **ID**: `auth.login.blocked-account`
- **EVIDENCE**: `go-unit::./internal/auth::TestBlockedAccount`
- **EVIDENCE**: `pytest-functional::tests/functional/test_auth.py::test_blocked_account`
- **WHEN** a blocked account submits otherwise valid credentials
- **THEN** authentication is rejected
```

Keep each scenario to one request and one independently failing outcome. Put independently failing behavior in separate scenarios.

## Verification sequence

```sh
focused-spec validate --syntax-only
focused-spec validate
focused-spec run
```

For an active change with planned evidence, validate without `--strict`:

```sh
focused-spec validate --change add-auth --syntax-only
focused-spec validate --change add-auth
```

Planned targets are not resolved; success at this stage proves only the available structure and concrete targets. After replacing planned references with real tests, run `focused-spec validate --change add-auth --strict` and `focused-spec run --change add-auth`. `run` always performs strict validation first.
