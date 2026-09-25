## 1. Help dispatch and content

- [x] 1.1 Add root and per-command help dispatch to `src/cli.ts` so `--help`, `-h`, and `help [validate|run]` exit zero with text before loading config; preserve errors for unknown commands.
- [x] 1.2 Render a root overview plus distinct `validate` and `run` help with all accepted command options, accurate scope/strict/planned/skip semantics, and usable examples.
- [x] 1.3 Replace full usage dumps on absent/invalid command or option syntax with a concise stderr diagnostic and relevant help pointer, preserving nonzero exit.

## 2. Executable contract and documentation

- [x] 2.1 Add subprocess CLI checks in `test/cli.spec.ts` for the five focused scenarios, including aliases, option sets, stdout/exit status, config-free help, `--json` precedence and invalid-input errors; replace the five `planned:` selectors with exact tests.
- [x] 2.2 Update `docs/reference/cli.md` with help invocations and result/error semantics; verify its links and examples without introducing a parallel normative page.

## 3. Verification

- [x] 3.1 Build and exercise the actual CLI for root, validate, run, config-free and invalid-invocation paths; check ordinary validate/run JSON outputs remain unchanged.
- [x] 3.2 Run `node dist/cli.js validate --scope improve-cli-help --strict`, `node dist/cli.js run --scope improve-cli-help`, `npm test`, and `npm run smoke`; record outcomes. Archive/sync the new capability only after completing implementation and replacing planned evidence; then update the docs map for its new baseline page.
