# Spec Delta

## MODIFIED Requirements

### Requirement: Deliberate target selection
Init SHALL trim/deduplicate all 50 catalog IDs and aliases/destinations, rejecting empty/unknown IDs, invalid options/values and extra paths before writes; `all`/`none` are unsupported. Only TTY input/output without JSON or CI MAY open the interactive picker when `--tools` is absent. In that path, a searchable keyboard picker SHALL permit explicit multi-selection; detected directories are unselected suggestions, not permission. Selection SHALL distinguish global MiniMax before confirmation. With `--tools`, init SHALL retain the direct scripted path without a terminal screen, even on a TTY. Noninteractive/JSON input SHALL require `--tools`; cancellation SHALL not write.

<!-- focused-spec:id=init.selection.explicit -->
#### Scenario: Noninteractive initialization cannot infer authorization
- **WHEN** init runs without `--tools` through noninteractive input or JSON mode, including a project with detected agent directories
- **THEN** it exits nonzero with actionable selection guidance and does not modify the project

<!-- focused-spec:id=init.selection.interactive -->
#### Scenario: Interactive confirmation determines installed targets
- **WHEN** an interactive user searches and explicitly selects targets, proceeds through review, or cancels after seeing suggested integrations
- **THEN** only the nonempty selection confirmed after review is installed, or cancellation exits nonzero without writes
- **AND** merely detected targets and an unselected global MiniMax never become authorized by cursor placement or a default

<!-- focused-spec:id=init.selection.invalid -->
#### Scenario: Invalid selections and arguments are rejected
- **WHEN** a user supplies an empty or unsupported target, unknown option, missing value, or extra positional argument
- **THEN** init exits nonzero with an actionable diagnostic before any directory or file is created

## ADDED Requirements

### Requirement: Interactive installation has a bounded focus presentation
Only eligible interactive init SHALL show the approved golden eight-row `f` with a default 2200 ms skippable blur-to-sharp reveal. `--no-animation` SHALL show it immediately. Reduced terminal capabilities SHALL leave the glyph and controls readable without motion or reliance on color. Scripted init and other commands SHALL never show the presentation; it SHALL not imply installation or passing evidence.

<!-- focused-spec:id=init.focus.silhouette -->
#### Scenario: Picker focus resolves to the approved block form
- **WHEN** an interactive user opens init in a terminal supporting color and motion
- **THEN** its reveal becomes progressively sharper, settles on the eight-row square lowercase `f` with a one-block stem, a three-block top ledge and a three-block crossbar extending on both sides of the stem, and does not add curls or a separate diamond
- **AND** skipping the reveal immediately shows the same sharp glyph without waiting

<!-- focused-spec:id=init.focus.fallback -->
#### Scenario: Reduced terminal capabilities retain usable selection
- **WHEN** animation is disabled, color is unavailable, or the terminal is narrow
- **THEN** init shows a static, non-color-dependent glyph and usable selection controls without delaying installation review

<!-- focused-spec:id=init.focus.isolation -->
#### Scenario: Scripted initialization and ordinary commands never animate
- **WHEN** a user invokes init with explicit `--tools` on a terminal, requests JSON output, or runs another CLI command
- **THEN** no interactive installer screen or focus animation appears, and those commands retain their existing results

### Requirement: Interactive installation restores the terminal
Interactive init SHALL restore the cursor, input mode and screen on exit, error and interruption. Cancelling before confirmation SHALL leave project and home unchanged and SHALL not report successful installation.

<!-- focused-spec:id=init.session.restore -->
#### Scenario: Cancel or interruption returns the shell to normal
- **WHEN** a user cancels the picker, declines review, or interrupts init during its reveal or before confirmation
- **THEN** the terminal returns to normal input and display state without any installation writes or false success

### Requirement: Inspect planned integration before confirmation
Interactive init SHALL show exact selected destinations and their install, unchanged, replace or conflict actions before any non-preview write confirmation. Project and global paths SHALL be distinct. Review SHALL reuse ordinary root, asset and destination checks; conflicts block writes without explicit replacement. Dry-run, decline and cancellation SHALL leave both project and home untouched.

<!-- focused-spec:id=init.review.prewrite -->
#### Scenario: Mixed project and home setup requires informed consent
- **WHEN** the picker selects a project-local target and global MiniMax while one selected destination differs from the bundled asset
- **THEN** review identifies both destinations, the home location and the conflict before any writes; declining, cancelling, or lacking explicit replacement leaves both roots unchanged

<!-- focused-spec:id=init.review.preview -->
#### Scenario: Dry-run review performs no installation
- **WHEN** an interactive selection uses `--dry-run` and reaches action review
- **THEN** the terminal displays the checked plan without writing project or home files, and the existing preview exit/result semantics remain authoritative
