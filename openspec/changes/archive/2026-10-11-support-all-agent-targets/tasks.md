# Tasks

## 1. Canonical catalog and native delivery

- [x] 1.1 Add the fixed 50-target OpenSpec 1.14.1 catalog in `src/init-targets.ts`, preserving every audited skill/command destination and the project/global base distinction; normalize `windsurf` to `devin` before selection deduplication and reporting.
- [x] 1.2 Integrate the catalog into `src/init.ts` selection, detection and help; deduplicate shared loader destinations for Amp, Antigravity, Codex, GSD, Zed and agents while retaining the Antigravity workflow. Preserve existing OMP/Claude paths and require deliberate TTY/noninteractive selection.
- [x] 1.3 Create or update all 34 bundled native wrappers listed in the design, preserving Markdown/frontmatter, TOML, `.prompt` and `.prompt.md` host contracts, focused-spec identity and native task arguments. Install no fake commands for the 16 skills-only targets and no embedded workflow or extra tool permissions.
- [x] 1.4 Provide target-appropriate invocation/setup hints, including Hermes external-directory configuration and Copilot IDE-only prompt limitations, without editing host settings or changing the existing portable loader/guidance.

## 2. Explicit global MiniMax and safe multi-root installation

- [x] 2.1 Resolve the canonical existing home root only when MiniMax is selected; install only `.minimax/skills/focused-spec/SKILL.md` under that root and clearly identify the global destination before interactive confirmation. Preserve the selected canonical project root and project-only home isolation.
- [x] 2.2 Extend existing preflight, asset validation, destination inspection and actual-destination deduplication across both roots before any write. Reject unsafe roots/components/destinations and abort both trees on any known conflict or missing asset.
- [x] 2.3 Preserve no-op, exclusive creation, replacement rechecks and truthful partial-write reporting across both bases. Keep replacement limited to selected regular integration files, preserve neighboring/unselected files, and make dry-run write-free in both trees.
- [x] 2.4 Preserve the JSON envelope and project-relative paths; report canonical absolute MiniMax file/error paths, normalized tools and accurate action/applied flags. Explain this global exception and explicit selection in every supported initialization help form without reading or modifying integration state.

## 3. Packed-consumer behavioral evidence

- [x] 3.1 Add independently audited expected destinations/native grammars in `test/fixtures/agent-targets.json`; extend packed-consumer helpers in `test/package.spec.ts` for full-tree inspection and isolated home environments without deriving expectations from the production catalog.
- [x] 3.2 Implement the exact `init.targets.catalog`, `init.targets.native-formats` and `init.targets.alias` evidence targets named in the design: execute all 50 canonical targets offline from the installed packed package, check unwanted-path absence, parse native wrappers/arguments, and exercise alias/shared-root deduplication.
- [x] 3.3 Implement every exact MiniMax evidence target named in the design: `init.global.minimax`, `init.global.preview`, `init.global.conflict`, `init.global.replace`, `init.global.unsafe`, and `init.global.reporting`. Check both root trees, outside symlink targets, neighboring files, canonical absolute reporting and completed-write state through the actual packed CLI.
- [x] 3.4 Update all 14 affected existing agent-init evidence targets and `cli.help.init` in `test/package.spec.ts`/`test/cli.spec.ts` for the expanded contract; retain deterministic PTY selection and empty/Ctrl-C/EOF cancellation evidence. Register all 24 native outcomes under `support-all-agent-targets` in the existing capability shards only after their executable targets exist.
- [x] 3.5 Run exact working-scope validate/run and product sensitivity for all 24 affected outcomes: establish PASS, introduce a relevant controlled product regression, observe the consumer assertion FAIL, restore and observe PASS. Preserve fresh proof records without rewriting historical eval results.

## 4. Owning documentation and end-to-end completion

- [x] 4.1 Update `docs/guides/install.md` and `docs/reference/cli.md` with the complete catalog/native delivery, alias/shared-root behavior, explicit global MiniMax authority, JSON path exception, safety and host-specific setup limits; keep their section indexes and `docs/README.md` coherent and validate local links/reachability.
- [x] 4.2 Run `npm test`, strict native validation and the real affected packed CLI path; exercise available host wrapper/skill surfaces and report unavailable host-runtime activation separately from verified installer/native-format behavior.
- [x] 4.3 Sync the validated deltas into `openspec/specs/agent-init/spec.md` and `openspec/specs/cli-help/spec.md`, publish the approved native bindings, archive this completed change using the host workflow, and run final all-scope validation/evidence. Report observed results and limitations without release, publishing or unrelated change edits.
