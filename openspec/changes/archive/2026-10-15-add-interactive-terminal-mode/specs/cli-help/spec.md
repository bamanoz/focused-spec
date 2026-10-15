# Spec Delta

## MODIFIED Requirements

### Requirement: Initialization help
Init help SHALL support `init --help`, `init -h` and `help init` without config, prompts, assets or project/home inspection/mutation. It SHALL explain path, all 50 IDs/destinations, alias/shared roots, native setup, explicit selection, preview/JSON/replacement, preservation and installation-only success. MiniMax SHALL be identified as explicitly selected global-only integration with absolute JSON paths. Interactive picker/search/review controls and `--no-animation` SHALL be shown. Help SHALL stay human-readable with JSON.

<!-- focused-spec:id=cli.help.init -->
#### Scenario: Init help is available before project setup
- **WHEN** a user requests init help through any supported form before setup, including JSON mode
- **THEN** help identifies the complete canonical catalog, alias, safety and explicit global boundary without reading or writing project/home integration state or claiming evidence readiness
- **AND** help explains the optional project path, `--tools`, `--dry-run`, `--json`, `--replace`, `--no-animation`, default conflict preservation, keyboard/review controls and target-appropriate invocation/setup hints
