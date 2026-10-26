# Development

- [Repository workflow](workflow.md)
- [Coordinated npm suite and separate Go, Python, and .NET SDK release gates](releasing.md)
- [Agent evaluations](agent-evals.md)
- [Candidate improvements](candidate-improvements.md)

Run the standard checks before handoff:

```sh
npm ci
npm test
npm run smoke
```

Use the narrowest relevant check while iterating, then run the full package check for permanent changes.
