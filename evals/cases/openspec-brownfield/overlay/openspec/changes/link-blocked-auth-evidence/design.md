## Context

The main OpenSpec spec contains historical native scenarios without focused-spec markers or registry bindings. Go and Python tests already exercise the newly selected outcome.

## Decisions

- Use version-5 configuration and explicitly compose the installed Markdown parser through the registry adapter.
- Register the installed official runner packages under IDs `go` and `pytest`.
- Configure pytest to execute through `uv run --with pytest python`.
- Require both evidence targets to execute for the blocked-account valid-credential outcome.
- Preserve untouched native scenarios when syncing the delta into the existing main spec.
