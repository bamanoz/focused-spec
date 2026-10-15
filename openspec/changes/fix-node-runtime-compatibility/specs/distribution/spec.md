# distribution delta

## ADDED Requirements

### Requirement: Script-free prepared package packing
Packing an already-built core package with `npm pack --ignore-scripts` SHALL preserve and include its prepared runtime rather than rebuilding or restaging shared output. Ordinary core packing SHALL still build and stage current authored assets, and checkout installation SHALL retain its build lifecycle.

<!-- focused-spec:id=distribution.package.script-free-pack -->
#### Scenario: Packing prepared output does not replace it
- **WHEN** an already-built core package is packed with scripts disabled on the npm version bundled with the minimum supported Node.js release
- **THEN** the archive contains the prepared runtime, including a prepared module without a corresponding source file, and packing leaves that output intact
