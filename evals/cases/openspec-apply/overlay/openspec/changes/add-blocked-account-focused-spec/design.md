## Context

The same product outcome is covered by a Go unit test and a pytest functional test.

## Decisions

- Use version-5 configuration and explicitly compose the installed Markdown parser through the installed registry adapter.
- Register the installed official runner packages under IDs `go` and `pytest`.
- Configure pytest to execute through `uv run --with pytest python`.
- Keep selectors opaque to focused-spec core.
- Require both evidence targets to pass.

## Non-Goals

- Changing authentication behavior.
- Adding parser or test-framework logic to focused-spec core.
