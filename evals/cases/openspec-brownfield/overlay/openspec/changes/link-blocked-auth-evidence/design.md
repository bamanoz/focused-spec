## Context

The main OpenSpec spec contains historical native scenarios without focused-spec markers or registry bindings. Go and Python tests already exercise the newly selected outcome.

## Decisions

- Use project-local Go and Python runners based only on the public `focused-spec/runner` API.
- Require both evidence targets to execute for the blocked-account valid-credential outcome.
- Preserve untouched native scenarios when syncing the delta into the existing main spec.
