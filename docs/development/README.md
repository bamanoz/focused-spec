# Development

- [Repository workflow](workflow.md)
- [Release process](releasing.md)
- [Agent evaluations](agent-evals.md)

Run the standard checks before handoff:

```sh
npm test
npm run smoke
```

Use the narrowest relevant check while iterating, then run the full package check for permanent changes.
