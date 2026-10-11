## 1. Explicit bundled integration

- [x] 1.1 Implement CLI-only package-relative asset loading and the four fixed target mappings from design; bundle minimal Oh My Pi/Claude skill-loading wrappers and preserve the existing loader as the sole bootstrap.
- [x] 1.2 Implement explicit project-root/target parsing, interactive confirmed selection, noninteractive/JSON explicit-selection requirement, shared-destination deduplication, and no evidence-config loading.
- [x] 1.3 Implement full preflight planning, identical-file no-op, conflict-before-all-writes, narrowly authorized replacement, root/ancestor/symlink safety, and destination rechecks.
- [x] 1.4 Implement write-free dry-run, deterministic text/JSON action and error reporting, partial-I/O reporting, exit codes, and command help using existing CLI conventions.

## 2. Consumer behavior and evidence

- [x] 2.1 Implement/update the exact consumer checks mapped to each native ID in design's executable evidence plan; use real packed installed CLI calls rather than source-layout assertions or mock-copy checks.
- [x] 2.2 Exercise interactive selection/cancellation through the actual CLI terminal; verify OMP/Claude wrappers and Codex loader in available runtimes, reporting unavailable routing verification explicitly.
- [x] 2.3 Register each implemented outcome in its capability-owned shard for this working scope and preserve independent scope-local help/distribution evidence; replace every `planned:` reference only after its target exists.
- [x] 2.4 Run selected focused evidence, introduce controlled behavioral regressions in disposable installations, observe selected assertion failures, restore and rerun; cover conflict preservation, narrow replacement, preview and safety boundaries.

## 3. Documentation and completion

- [x] 3.1 Update the installation guide and CLI reference with the explicit bundled init contract, target paths, repeat/conflict/replace behavior, and installation-only success; keep npm-only installation side-effect-free and do not duplicate the authoritative workflow.
- [x] 3.2 Update documentation/capability indexes and validate local links and actual command examples; document supported runtime invocation forms without inventing a shared-agent slash syntax.
- [x] 3.3 Run `npm test`, packed offline consumer initialization/reinitialization/preview smoke, strict OpenSpec validation, and strict focused validation plus `run --scope add-agent-init`; report exact commands, results, and runtime limitations.
- [x] 3.4 After implementation evidence passes, sync through OpenSpec, retire obsolete working registrations, archive through the host workflow, then validate and run surviving explicit evidence. Do not release or publish without a separate request.
