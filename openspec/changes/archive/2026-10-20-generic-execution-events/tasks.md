# Tasks

## 1. Generic core boundary

- [x] 1.1 Replace the closed core union/export, kind-based validation, collector stop condition and CLI dispatch; revise existing integration and CLI assertions plus API/CLI reference docs. Verify the exact changed tests reject the prior implementation and pass after the cutover.

## 2. Producer translation

- [x] 2.1 Translate SDK events inside both direct runners and migrate runner-facing assertions and runner documentation without changing SDK-only contracts. Verify existing bank failure tests and actual detailed/JSON bank execution for both languages.

## 3. Integrated evidence

- [x] 3.1 Bind active-scope evidence in the existing capability registries, strictly validate and execute the changed scope, prove controlled product-regression sensitivity and restore passing evidence; run npm test and both real bank CLI paths.

Verification: `npm test` passed 21 files / 388 tests. Active scope strict validation and execution passed all four enrolled outcomes. In an isolated workspace, all four passed before and after four product regressions yielding five selected assertion failures: a closed kind list (optional and bounded outcomes), removed envelope validation, producer-kind collection stop and unescaped kind display. Real TypeScript and Go bank detailed execution passed; existing packed-bank detailed/JSON checks passed for both languages. Documentation links were checked separately.

## Workflow follow-up

- Sync the verified delta, archive through OpenSpec and verify final current-scope evidence and documentation links.
