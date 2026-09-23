# Agent evaluations

The eval harness provisions a clean workspace, installs the packed CLI, copies only selected skills, runs an OMP agent, and judges the resulting behavior.

## Cases

```sh
npm run eval:agent -- --list
```

- `files-source-bootstrap`: create file-backed scenario and Go/pytest runners.
- `openspec-apply`: apply an existing OpenSpec change.
- `openspec-propose-apply`: proposal turn followed by a fresh apply turn.
- `full-skill-routing`: expose all OpenSpec workflow skills and test routing.

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
- Go and pytest evidence both exist and pass;
- existing product tests remain unchanged and pass;
- controlled Go and Python regressions make the focused evidence fail;
- the agent does not inspect implementation source or use `shell: true`;
- proposal turns do not start implementation.

The result is written to gitignored `evals/results/<case>-<timestamp>.json`. `--keep-workspace` retains the isolated workspace for diagnosis. A model-specific pass is evidence for that model and prompt; it is not a universal capability claim.
