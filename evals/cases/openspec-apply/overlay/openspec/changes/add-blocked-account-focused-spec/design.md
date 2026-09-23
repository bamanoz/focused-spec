## Context

The same product outcome is covered by a Go unit test and a pytest functional test.

## Decisions

- Register separate `go-unit` and `pytest-functional` runner instances.
- Implement each runner as project-local TypeScript using the public `focused-spec/runner` API.
- Keep selectors opaque to focused-spec core.
- Require both evidence targets to pass.

## Non-Goals

- Changing authentication behavior.
- Adding test-framework logic to focused-spec core.
