## Context

The skill and black-box evaluation harness already require a controlled product-regression check and observable skill activation. The agent-workflow specification predates those changes. This is a retrospective contract synchronization; implementation was committed before this change was opened.

## Goals / Non-Goals

**Goals:** Record the shipped agent evidence-sensitivity and activation behavior, with exact existing Vitest evidence, and synchronize the main agent-workflow specification.

**Non-Goals:** Change the CLI, make the CLI mutate consumer code, or claim an agent evaluation is a universal guarantee across models and workspaces.

## Decisions

- Keep the contract in the framework-neutral `agent-workflow` capability. The OpenSpec eval is one host integration, not a trigger baked into the focused-spec skill.
- Use separate scenarios for detecting vacuous evidence and requiring skill activation. The first tests selected evidence against a controlled product regression; the second prevents a coincidental success without reading the skill.
- Preserve existing scenario owners and evidence during delta synchronization; after archive, the main specification is the durable owner.

## Risks / Trade-offs

- The unit tests defend evaluation gates. One real agent run established behavior for that particular agent and model, not for every model or consuming project.
- The sensitivity check is a skill instruction; a project runner and test can still lie if the agent fails to follow it. The eval detects this in its isolated fixture, not in arbitrary consumer workspaces.
