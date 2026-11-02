# JUnit Reports and GitHub Action

## Purpose

Expose focused-spec execution results through JUnit XML and a reusable GitHub Action, without replacing the CLI's detailed JSON result or misrepresenting test results as static-analysis findings.

## ADDED Requirements

### Requirement: Optional JUnit run report
`focused-spec run` SHALL optionally write JUnit XML derived from the existing result without rerunning evidence. Each selected scenario SHALL be a separate testcase identified by scope and exact ID, with native name and source provenance. PASS, FAIL, ERROR and SKIP SHALL remain distinct. Nonpassing evidence diagnostics SHALL be included where available. XML-special and invalid XML characters SHALL NOT corrupt the report.

<!-- focused-spec:id=execution.report.junit -->
#### Scenario: JUnit file reflects selected execution results
- **WHEN** a run requests a report path and selected scenarios produce PASS, FAIL, ERROR, and SKIP outcomes
- **THEN** the CLI writes parseable JUnit XML with one distinguishable testcase per scope/ID occurrence, retaining native names, source provenance, outcomes and relevant diagnostics without rerunning targets

### Requirement: Preflight report status
A requested report SHALL describe strict validation or evidence-resolution failure before execution as a suite-level failure with its actual violations and no executed testcases. A valid empty run SHALL produce an empty suite without a fabricated testcase. Existing exit status and JSON violations SHALL remain authoritative.

<!-- focused-spec:id=execution.report.preflight -->
#### Scenario: Report represents a run that cannot execute
- **WHEN** a run requests a report path but strict validation or evidence resolution fails before execution
- **THEN** the CLI writes a valid report for the unsuccessful preflight without inventing executed cases or passes, and retains the existing exit status and JSON violation result

<!-- focused-spec:id=execution.report.empty -->
#### Scenario: Empty selection is not reported as proof
- **WHEN** a run requests a report path and valid selection yields no executed targets or scenarios
- **THEN** the report is valid and represents an empty run without fabricating a passing testcase

### Requirement: Report write failures
If a requested report destination cannot be created or written, the CLI SHALL fail with an actionable error and SHALL NOT return successful status. Any already-produced execution outcome SHALL remain available in diagnostics or JSON output.

<!-- focused-spec:id=execution.report.output-errors -->
#### Scenario: Report destination cannot be written
- **WHEN** the report destination cannot be created or written
- **THEN** the command fails with an actionable error and does not return successful status, while preserving any already-produced execution outcomes in diagnostics or JSON

### Requirement: Reusable GitHub Action for run reports
A composite Action SHALL invoke focused-spec from an explicit or existing installation, write JUnit to a caller-selected path, and expose the report path and actual command success. It SHALL NOT install unpinned dependencies or equate report generation with evidence success.

<!-- focused-spec:id=execution.report.github-action -->
#### Scenario: Consumer obtains report and truthful outcome
- **WHEN** a workflow invokes the composite action with focused-spec available and selected evidence completes
- **THEN** the action exposes the configured report location and the CLI's true success or failure while allowing a separately configured artifact step

### Requirement: Untrusted pull request action usage
Usage guidance for untrusted pull-request runs SHALL require read-only permissions, provide no secrets or write-capable token, and avoid privileged upload or publication in the same untrusted execution context.


<!-- focused-spec:id=execution.report.untrusted-pr -->
#### Scenario: Untrusted pull request cannot use report action to gain privileges
- **WHEN** a workflow runs the action for an untrusted pull request
- **THEN** documented usage requires read-only permissions, supplies no secrets or write token, and does not couple untrusted execution with privileged report publication or upload
