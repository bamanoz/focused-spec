# Scenario execution delta

## MODIFIED Requirements

### Requirement: Detailed and compact presentation share one result
The run-only `--details` option SHALL show events for every evidence result; compact output SHALL show only nonpassing evidence events. All kinds SHALL use the same escaped kind, message and optional JSON data presentation without semantic dispatch. JSON SHALL retain every event regardless of `--details`. Display mode SHALL NOT change collection, selection, status, timings or execution count.

<!-- focused-spec:id=execution.events.presentation -->
#### Scenario: Detail is a presentation choice rather than another execution mode
- **WHEN** passing and failing evidence report arbitrary producer-defined kinds in compact, detailed and JSON modes
- **THEN** all modes retain identical actual outcomes, JSON retains both targets' events, and human output renders their kinds, messages and data uniformly with control characters escaped and without rerunning targets for display
