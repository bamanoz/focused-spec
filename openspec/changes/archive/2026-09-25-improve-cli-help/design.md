## Context

`src/cli.ts` parses arguments with a small hand-written dispatcher. Its `USAGE` constant lists only syntax; both top-level and command-level `--help` are treated as errors. `main` currently enters config loading immediately after parsing. `docs/reference/cli.md` owns the public CLI contract, and `test/cli.spec.ts` exercises the installed `dist/cli.js` as a subprocess. OpenSpec's help demonstrates two useful levels: command overview and per-command options; focused-spec only needs its two existing commands.

## Goals / Non-Goals

**Goals:** Successful, useful help for the root and each command; accurate option descriptions, defaults and examples; config-free help; error guidance with failure exit status; no changes to real validation or execution outputs.

**Non-Goals:** A general CLI framework, interactive help, shell completion, `--version`, additional commands, or changing the runner/configuration contract.

## Decisions

1. Keep help rendering in `src/cli.ts` as a small root/help-for-command dispatcher and static text for the three surfaces. Avoid importing Commander solely for two commands: the existing parser is small, and a second parser would duplicate option ownership. Keep supported switches and their explanations close to argument parsing; review the displayed list against both accepted branches whenever options change.
2. Recognize `focused-spec --help`, `-h`, `help`, `help validate`, `help run`, and `<command> --help|-h` before calling `loadConfig`, `validateFocusedSpecs`, or `planEvidence`. Successful help writes human-readable text to stdout and exits zero, even outside a configured project. The explicit `help` command accepts only a known command; unknown commands remain errors even if followed by `--help`. For a known command, help takes precedence over its other options, as in conventional CLI help. Help is always text even if `--json` is also present; it is not a validation result.
3. Root help shows a one-line purpose, `Usage`, concise descriptions of `validate`/`run`, global invocation guidance and examples pointing to command-specific help. Command help includes the full command usage, every supported option with its meaning, relevant defaults and at least one runnable invocation. State explicitly that `validate --syntax-only` skips runner resolution, non-strict validation permits planned evidence only in named scopes, `--strict` disallows it, `run` strictly validates before executing, `--scenario` narrows execution only, and `--allow-skip` does not turn SKIP into PASS.
4. Invalid/no command and unknown/missing options keep exit 1 and stderr diagnostics, but point to `focused-spec --help` or `<command> --help` rather than printing the entire two-line usage for every error. Do not turn invalid input into a successful help request. No config/project evaluation on explicit help, so help remains usable before project setup.
5. Exercise the public CLI via `spawnSync` in `test/cli.spec.ts`, verifying exit status, stdout/stderr, command-specific option discovery, and no config dependency without pinning full prose. Update `docs/reference/cli.md` as the normative owner; use the existing documentation map rather than adding a second CLI guide. When archiving the completed change, sync this delta into a new baseline `cli-help` spec and link that new page from the documentation map.

## Risks / Trade-offs

- Static help can drift from parsing → cover accepted options and their availability in subprocess checks; keep edits in the same CLI file.
- Eager help dispatch could hide malformed arguments → limit successful dispatch to known command names and recognized help forms; preserve nonzero errors otherwise.
- Help prose could imply that planned evidence executes → describe validation and execution selections precisely, and check examples against the CLI reference.

## Migration Plan

Additive CLI behavior: no migration for scripts using `validate`/`run`. Existing invocations keep their output and exit semantics; only explicit help and argument-error guidance change. Revert the help dispatcher and copy if rollback is needed.
