# Tasks

## 1. Interactive init presentation

- [x] 1.1 Implement init-only terminal capability detection, bounded session cleanup and the exact golden eight-row focus glyph from `scripts/preview-focus.mjs` in core-owned code; verify via a real PTY that the 2200 ms reveal can be skipped and yields the approved static silhouette.
- [x] 1.2 Add `--no-animation`, `NO_COLOR`/`TERM=dumb` and narrow-width fallback rendering without control codes in unsupported output; verify actual static frames, readable key hints and restored cursor/input state after cancel and signal in PTY cases. Confirm explicit `--tools`, JSON, CI and ordinary commands never open the screen.

## 2. Interactive agent setup

- [x] 2.1 Extract existing init preflight into a shared plan/apply boundary and replace only TTY-without-`--tools` input with searchable multi-selection plus explicit home labels; verify isolated terminal selection never preselects detected agents or global MiniMax and preserves `--tools`/JSON behavior.
- [x] 2.2 Implement the action/destination review and separate install confirmation, including conflict and `--dry-run` paths; verify project/home byte snapshots on cancel, conflict and preview, and a confirmed install using the packed local CLI.
- [x] 2.3 Update `docs/guides/install.md`, `docs/guides/agent-install.md` and init help with keys, global consent, preview and completion boundaries; verify links and copy-paste examples, and execute the documented terminal and explicit-target forms.

## 3. Integrated evidence and package checks

- [x] 3.1 During apply, bind each new/changed scenario ID in `agent-init` and `cli-help` to exact full Vitest selectors in their existing capability-owned `.focused-spec/evidence/*.yaml` files; validate and execute the selected scope with the explicitly installed local focused-spec CLI, retaining every still-relevant AND member.
- [x] 3.2 Demonstrate sensitivity for changed outcomes with a controlled product regression in a disposable copy, observe exact selected assertions fail, restore and observe PASS; run `npm test`, a packed-consumer TTY smoke and the affected CLI/init example path, recording environment-specific limitations without calling partial checks green.

## Workflow follow-up

- After authorized implementation and evidence checks, sync/validate/archive through the repository OpenSpec workflow; those lifecycle actions are not part of this proposal.
