# Proposal

## Why

The project’s user-facing entry points mix product orientation with internal ownership notes, implementation status, and setup details that are not consistently executable or available from package registries. Users need a concise path chooser and documentation that accurately describes how to install, run, and consume the currently shipped product.

## What Changes

- Reshape the root README into a concise product overview with one clear path chooser for SDK-only executable scenarios versus CLI-based native-requirement evidence; retain essential installation examples, a runnable inline-plus-Vitest example, and links to deeper documentation.
- Pin the agent-install URL to the current release tag and make package-registry availability statements reflect observed availability without promising unpublished plugin installation.
- Improve consumer-facing wording for the framework-neutral evidence-layer positioning, worktree consumer prerequisites, and source-checkout examples; remove delivery status and operational assurances from the root README.
- Simplify the documentation map, remove the internal candidate-improvements register from user-facing navigation, and remove versioned-document references to ignored evaluation artifacts.
- Repair staged root-README links for the published core package and give each runner package a package-specific README instead of copying the general runner guide to every package.
- Correct stale instruction references outside the .NET installation material, and update package README installation guidance where Python/.NET CLI plugins are not published.
- Preserve the independently governed .NET SDK installation sections; this change does not edit or redefine them.

## Capabilities

### New Capabilities

- `user-documentation`: User-facing documentation consistently explains product purpose, available installation paths, runnable examples, package availability, and navigation to authoritative details.

### Modified Capabilities

None.

## Impact

Root and package README content, `docs/README.md`, documentation navigation and examples, applicable package-specific READMEs, and README staging in `scripts/stage-assets.mjs`. No runtime behavior, package publication, SDK installation procedure, guidance acquisition procedure, OpenSpec/Spec Kit integration, or code implementation is authorized here. Related unpublished-plugin documentation remains aligned with the separately owned distribution proposal; its .NET installation sections are excluded from this change.
