# Agent evaluations

The eval harness provisions a clean workspace, installs the packed CLI, copies only selected skills, runs an OMP agent, and judges the resulting behavior.

## Cases

```sh
npm run eval:agent -- --list
```

- `files-source-bootstrap`: create file-backed scenario and Go/pytest runners.
- `openspec-apply`: apply an existing OpenSpec change.
- `openspec-propose-apply`: proposal turn followed by a fresh apply turn.
- `full-skill-routing`: with all OpenSpec skills available and no recipe in the prompts, choose the proposal/apply workflows, plan at least one exact test for the existing behavior, and execute its focused evidence. Either the Go unit test or the pytest functional test is valid; if both are chosen, both must pass.
- `openspec-brownfield`: adopt focused-spec in an OpenSpec project whose main specification was produced by a real, isolated OpenSpec 1.6.0 proposal/apply/sync/archive of blocked-account behavior without the focused-spec CLI or skill. The case overlay contains the resulting `account-authentication` spec, archived change, and Go/Python implementation and tests. The next agent enrolls the existing blocked-valid-credentials scenario, retaining the other three native scenarios and reporting partial coverage. Gates execute both selected tests, require durable main-scope evidence, and confirm it remains executable after the working document leaves discovery; a delta-only pass is not coverage.

The brownfield baseline was captured from a disposable Go/Python project where authentication initially checked credentials but not blocked status. An agent with only OpenSpec skills implemented the change, verified Go/Python behavior, and archived it; its unmodified final spec has four native `WHEN`/`THEN` scenarios and no focused metadata. The later evidence-linking delta is the eval task, not part of that bare OpenSpec run. Its archived baseline is protected against modifications by the eval agent.

OpenSpec cases require a skills source:

```sh
npm run eval:agent -- \
  --case openspec-propose-apply \
  --openspec-skills /path/to/openspec-skills \
  --timeout 1200
```

## Judged invariants

- strict focused-spec validation and real evidence execution pass;
- OpenSpec validation and tasks are complete when applicable;
- selected Go and/or pytest evidence actually executes and passes; cases that explicitly require both languages check both;
- existing Go and Python product tests remain unchanged and pass;
- controlled regressions in every selected implementation make its focused evidence fail;
- the agent does not inspect implementation source or use `shell: true`;
- proposal turns do not start implementation.

The result is written to gitignored `evals/results/<case>-<timestamp>.json`. `--keep-workspace` retains the isolated workspace for diagnosis. A model-specific pass is evidence for that model and prompt; it is not a universal capability claim.
