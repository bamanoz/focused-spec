# user-documentation Specification

## Purpose
Define the user-facing documentation contract for accurately introducing focused-spec, guiding users to runnable setup paths, and keeping published package documentation useful outside the source checkout.

## Requirements

### Requirement: Root README is a concise user entry point
The root README SHALL explain the product's purpose and principal capabilities, provide one clear chooser between independent SDK scenarios and CLI-based native-requirement evidence, give runnable installation/example guidance, and link to deeper user documentation. It SHALL NOT contain release-specific versions, publication or implementation status, evaluation metrics, internal plans, candidate registers, or internal tracking links.

Manual-review identity: `user-docs.onboarding.path-choice`.
#### Scenario: A new user chooses a supported product path
- **WHEN** a user follows the root README to get started
- **THEN** the README distinguishes SDK-only executable scenarios from CLI-based evidence for native requirements and directs each path to its authoritative setup documentation without duplicating competing setup procedures

<!-- focused-spec:id=user-docs.onboarding.inline-vitest-example -->
#### Scenario: README inline example can be run as documented
- **WHEN** a user installs the README's inline Markdown and Vitest prerequisites and follows its example
- **THEN** the documented scenario and exact evidence selector resolve to the named existing Vitest test using only the shown format and runner packages

### Requirement: User-facing claims reflect available distributions
Installation and package documentation SHALL distinguish published registry packages from checkout-only or otherwise unpublished packages, and shall provide installation instructions that work for the stated distribution. Agent-install instructions SHALL use a release-tagged URL rather than a mutable main-branch URL. These claims SHALL NOT edit or redefine independently owned .NET SDK installation procedures.

Manual-review identity: `user-docs.distribution.plugin-availability`.
#### Scenario: Python and .NET CLI plugins are not available from npm
- **WHEN** a consumer reads instructions for Python or .NET scenario format/runner plugins that are not published to npm
- **THEN** the documentation does not prescribe installing those packages from npm as if they were available and clearly identifies the supported current source-checkout path or the absence of a published install path

Manual-review identity: `user-docs.install.agent-url`.
#### Scenario: Agent installation guide is release-pinned
- **WHEN** a user copies the agent-install instruction from the root README
- **THEN** its URL identifies the current released tag rather than the mutable main branch

### Requirement: Documentation navigation is user-oriented
The documentation map SHALL prioritize concise navigation to concepts, installation, configuration, CLI/plugin references, SDKs, and development resources. User-facing navigation SHALL NOT link to internal candidate-improvements material, and versioned documentation SHALL NOT rely on ignored local evaluation artifacts as evidence.

<!-- focused-spec:id=user-docs.navigation.progressive-map -->
#### Scenario: User finds a relevant documentation entry quickly
- **WHEN** a user opens the documentation map
- **THEN** they see a short progressive route to the appropriate user or development documentation without internal ownership inventories or candidate tracking

Manual-review identity: `user-docs.navigation.public-evidence`.
#### Scenario: Published documentation has no ignored-artifact dependency
- **WHEN** a reader follows versioned documentation references
- **THEN** referenced evidence is available from tracked/public documentation rather than ignored local eval-result directories

### Requirement: Examples accurately describe consumer context
Consumer examples SHALL state where commands run and accurately expose prerequisites imposed by their dependency layout. A worktree example using checkout-relative `file:` dependencies SHALL NOT imply that its installation commands work from an arbitrary external worktree location.

Manual-review identity: `user-docs.examples.worktree-context`.
#### Scenario: Worktree consumer is reproduced from documented location
- **WHEN** a user follows the standalone worktree example instructions
- **THEN** the documented worktree location and command sequence satisfy its local dependency paths, or the example is clearly described as checkout-bound rather than a general external consumer

### Requirement: Staged package documentation works for package consumers
The README staged into the core npm package SHALL retain usable links from the published package context. Each runner package README SHALL describe that package's own framework, selector behavior, installation availability, and public contract rather than presenting an unrelated general guide as if it were package-specific.

Manual-review identity: `user-docs.packaged.core-links`.
#### Scenario: Core README links work outside the repository
- **WHEN** an npm consumer reads the published core package README
- **THEN** its image and documentation links resolve to public repository resources rather than broken checkout-relative paths

Manual-review identity: `user-docs.packaged.runner-readme`.
#### Scenario: Runner package README describes its package
- **WHEN** a consumer opens a runner package page
- **THEN** the README identifies that runner's own requirements and usage and does not present unrelated runner instructions as its package contract

### Requirement: Product positioning describes a framework-neutral evidence layer
User-facing product descriptions SHALL present focused-spec as a generic evidence layer connecting native behavioral requirements or executable scenarios to exact tests, without implying ownership of specification authoring, host lifecycle, or integrations that are outside this change.

Manual-review identity: `user-docs.positioning.evidence-layer`.
#### Scenario: Existing specification workflow remains the source of requirements
- **WHEN** a user reads product positioning for native specification evidence
- **THEN** the documentation describes focused-spec as linking and executing evidence for the host's native requirements while leaving specification creation and lifecycle with the host workflow
