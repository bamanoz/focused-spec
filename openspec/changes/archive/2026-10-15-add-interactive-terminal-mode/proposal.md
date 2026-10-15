# Proposal

## Why

The CLI can install agent integrations, but its terminal selection is a flat 50-target prompt followed by static text. We have an approved small golden pixel `f` and a working focus animation prototype; interactive setup should use that identity to make deliberate selection and pre-write review readable without compromising scripts or existing safety rules.

## What Changes

- Replace the current TTY-only comma-separated `init` selection with a searchable keyboard-operated target picker. Show detected agents as suggestions, selected destinations and planned actions before a separate confirmation; keep global MiniMax visibly global and opt-in, with existing conflict/preview/replacement safety.
- Play the approved golden pixel `f` focus animation (2.2-second default, skippable) only on interactive `init` without `--tools`, with static/monochrome and narrow-terminal fallbacks. The settled glyph is the eight-row block silhouette, not a curved or particle mark; the interface uses our warm gold-and-brown palette, not OpenSpec's logo, layout or color scheme.
- Leave scripted `init --tools`, `--json`, redirected/CI invocation, and all other CLI commands unchanged. No screen or animation opens automatically outside interactive `init`.

## Capabilities

### Modified Capabilities

- `agent-init`: keyboard selection, the approved focus animation and accessible fallbacks, pre-write review, separate authorization and terminal cleanup on the existing TTY-only installation path.
- `cli-help`: document updated init controls without loading project state.

## Impact

Core agent initialization and terminal presentation, interactive installation tests, package-consumer smoke checks, and the owning installation/CLI documentation. Reuse existing installer planning and safety checks rather than adding a second installation model. Keep the current config, plugin and guidance protocols, machine-readable result shapes, target catalog, evidence execution and package assets unchanged. The existing `scripts/preview-focus.mjs` is a design prototype, not a runtime dependency. Planning only here: no product implementation, executable evidence integration, spec sync or archive.
