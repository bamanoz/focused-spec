# Development

- [Repository workflow](workflow.md)
- [Coordinated npm suite and separate Go, Python, and .NET SDK release gates](releasing.md)
- [Agent evaluations, native capability/measurement boundaries, and immutable cross-case reports](agent-evals.md)
- [Candidate improvements](candidate-improvements.md)

Run the standard checks before handoff:

```sh
npm ci
npm test
npm run smoke
```

Use the narrowest relevant check while iterating, then run the full package check for permanent changes.

Before publishing, run `npm run release:check`; the [mandatory executable specification gate](releasing.md#mandatory-executable-specification-gate) must pass on the exact release revision.
