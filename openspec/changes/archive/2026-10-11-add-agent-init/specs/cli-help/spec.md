## MODIFIED Requirements

### Requirement: Discoverable top-level help
The CLI SHALL accept `focused-spec --help`, `focused-spec -h`, and `focused-spec help` as successful help requests. It SHALL show its purpose, usage, the available `validate`, `run`, `instructions`, and `init` commands with their distinct purposes, and a path to command-specific help on stdout, without running validation, execution, initialization, or guidance loading.

<!-- focused-spec:id=cli.help.overview -->
#### Scenario: Root help explains available commands
- **WHEN** a user requests root help using any supported form
- **THEN** the CLI exits successfully and distinguishes validation, evidence execution, package instructions, and explicit agent initialization, with detailed-help entrypoints and no implied execution or installation

## ADDED Requirements

### Requirement: Initialization help
The CLI SHALL accept `init --help`, `init -h`, and `help init` without reading configuration, prompting for targets, loading installation assets, or modifying project state. Help SHALL describe optional project path, supported target IDs and destinations, explicit noninteractive selection, `--dry-run`, `--json`, and `--replace`, default conflict preservation, and installation-only success. Help SHALL remain human-readable even with `--json`.

<!-- focused-spec:id=cli.help.init -->
#### Scenario: Init help is available before project setup
- **WHEN** a user requests init help using a supported form outside a configured project, including JSON mode
- **THEN** the CLI exits successfully with the initialization options and safety semantics without writing files or claiming evidence readiness
