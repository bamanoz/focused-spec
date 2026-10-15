# Design

## Context

See the adjacent proposal's Why section for motivation. `init.ts` already owns canonical roots, preflight, deduplicated destinations, replacement guards and truthful reports, but its TTY choice is a single readline question. The shipped CLI must work offline on Node 22.16+, including packed consumers with no checkout. `scripts/preview-focus.mjs` is the user-approved visual/timing reference, not an importable package asset.

## Goals / Non-Goals

**Goals:** a TTY-only installation picker over existing installer contracts; the exact accessible golden pixel mark; reliable review before installer writes; terminal restoration.

**Non-Goals:** change the agent target catalog, implicit agent selection, automatic spec/config/dependency generation, a new coverage metric, a second installation model, or ordinary `validate`/`run`/JSON results; the preview script is not a runtime dependency.

## Decisions

### Interactive installation only

Use the existing `init [path]` without `--tools` on a real input/output terminal for selection and review; `--tools` retains today's direct scripted path even on a terminal. JSON, redirected streams and CI never launch the picker or animation. Other commands, including `run`, retain their existing behavior. An all-purpose start screen would conflate setup and execution, so do not introduce one.

### One terminal adapter and one approved mask

Keep the established eight-row `f` mask as block coordinates: top `   ███`, next two rows `   █`, crossbar `  ███`, last four rows `   █`. Render the golden 2200 ms blur-to-sharp transition only on eligible interactive init. Input can skip immediately; no artificial pause after the sharp frame. Respect `NO_COLOR`, `TERM=dumb`, `CI`, and an explicit `--no-animation` on interactive init; show the sharp glyph and text controls immediately when animation is disabled. A monochrome/rudimentary terminal still receives readable text and keyboard commands. Fit the same display vertically at narrow widths, avoid cursor motion when unsupported, and render a static ASCII fallback if Unicode block glyphs cannot render. This is an internal installer renderer; built-in Node streams/TTY primitives suffice unless implementation evidence shows otherwise.

Visual direction: take OpenSpec as a reference for motion quality and finish, not for its mark, screen composition, gradients or palette. Use the approved pixel `f` as the only emblem; dark warm-brown background (`#17130F`), gold focal blocks and active selection (`#F9C56C`, matching the prototype), muted bronze for secondary highlights (`#A87445`), and legible warm off-white text (`#EADCC7`). Keep most rows quiet so the focused glyph and selected action remain visually dominant. Show installation actions with labels/symbols as well as color; never imply evidence PASS or treat installation as evidence readiness. The 2.2-second blur resolves into a steady, non-glowing glyph; subsequent navigation has immediate feedback without looping decoration. Check contrast and legibility in the actual terminal, including monochrome fallback.

### Installer selection remains a preflight-and-apply transaction boundary

Move the current asset/root/destination planning into a reusable preflight result consumed by both direct and interactive init, without relaxing `inspect`/`applyFile` rechecks. A filtered 50-target list supports search, arrows, Space toggle, Enter review and Escape/Ctrl-C cancel. Detection adds labels, not checkmarks; selecting MiniMax explicitly shows its absolute home destination. The review displays exact selected files, their `install`/`unchanged`/`replace`/`conflict` actions and roots, then requires a second positive key to apply. If a conflict exists without explicit `--replace`, show the conflict and do not present an actionable write confirmation. `--dry-run` displays the plan and exits without an apply prompt or writes. Conflicts or cancelled flows preserve selected and unselected files; later write I/O failures retain existing truthful partial-write reporting. An implicit replace toggle in the TUI would bypass existing authorization, so replacement remains the explicit CLI flag.

### Signal and screen lifecycle

Own terminal acquisition, raw input and alternate screen in a bounded init session with `finally` restoring cursor, input mode and screen on normal exit, error, Escape or Ctrl-C. Cancelling before confirmation writes nothing and never reports successful installation. The noninteractive installer does not acquire a terminal or change its semantics. Use the existing POSIX PTY test convention plus a Windows-compatible narrow smoke for noninteractive boundaries; document unsupported visual certification precisely.

## Exact evidence plan

Planning only: no executable bindings or `planned:` integration yet. During apply, update affected scope-local `(add-interactive-terminal-mode, ID)` registry entries in `.focused-spec/evidence/agent-init.yaml` and `.focused-spec/evidence/cli-help.yaml` using the existing registry adapter and runner `vitest`; resolve exact full selectors after writing behavioral tests, then run selected strict evidence. Proposed tests:

- `init.focus.silhouette`, `init.focus.fallback`, `init.focus.isolation`, `init.session.restore`: PTY golden-mask/skip/capability and cancel/error/signal restoration plus scripted-init/ordinary-command isolation in `test/cli.spec.ts` (or a focused terminal test module if the existing suite becomes unwieldy). Assert terminal output/state, not source strings; compare sharp glyph geometry after stripping ANSI.
- `init.selection.interactive`, `init.review.prewrite`, `init.review.preview`: PTY target selection/preview/cancel/confirm against isolated project and isolated home; byte-compare trees to prove no writes before confirmation or on conflict.
- `cli.help.init`: offline help assertions plus packed install boundary for interactive picker discoverability; check normal run/help never open the installer screen.

Carry forward still-relevant AND members of changed capability items; do not replace old behavioral evidence with weaker UI screenshots. For new/changed evidence, exercise the approved controlled product regression in a disposable worktree after apply, restore it and re-run to PASS. `openspec validate --strict` checks planning format now; proposal phase does not run future behavior.

## Risks / Trade-offs

- [50 agents exceed viewport height] → search, scroll, clear selection markers and explicit home-path review; never preselect detection.
- [Interactive cancellation may leave terminal modes behind] → bounded init-only session cleanup and PTY tests for skip, cancel, SIGINT, tiny viewport and errors.
- [ANSI, Unicode and truecolor support vary] → capability gates and a usable plain/static layout; do not put escape sequences into JSON, CI, logs or ordinary text.
- [Interactive mode increases maintenance weight] → no new public API or runtime dependency unless required by a demonstrated edge; keep view state separate from installer truth.

## Migration Plan

No configuration/data migration. Ship a TTY-only replacement for the existing init prompt, preserve `--tools` scripts. Update [install guide](../../../docs/guides/install.md), [agent install guide](../../../docs/guides/agent-install.md) where agent handoff changes, [CLI reference](../../../docs/reference/cli.md), and help/index links only if new pages are introduced. Roll back the terminal presentation independently of the unchanged installer plan and evidence execution contracts.
