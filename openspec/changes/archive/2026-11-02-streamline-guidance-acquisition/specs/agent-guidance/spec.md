# Spec Delta

## MODIFIED Requirements

### Requirement: Versioned guidance response
Protocol-1 JSON SHALL be one object with protocolVersion 1, package name focused-spec and installed version, exact requested topic and nonempty Markdown content. Operation requests SHALL include clearly distinct complete workflow-router and operation guidance while retaining the requested topic. Workflow-only requests SHALL return the router without unrelated operation guidance.

<!-- focused-spec:id=guidance.delivery.compatible-update -->
#### Scenario: An unchanged loader receives an updated package's guidance
- **WHEN** a consumer replaces one protocol-1 package with another protocol-1 package while retaining the same loader request
- **THEN** the next guidance request returns the replacement package's version and requested topic rather than the previous installation's instructions
- **AND** Text output SHALL identify the serving package version, protocol, and topic and contain the corresponding guidance. Package versions, configuration versions, and runner API versions SHALL NOT be interpreted as loader protocol versions. A compatible package update SHALL NOT require changing the loader merely because the package version changed.

<!-- focused-spec:id=guidance.delivery.combined-operation -->
#### Scenario: Operation request returns router and operation guidance together
- **WHEN** a consumer requests protocol-1 JSON instructions for `author-revise` from an installed CLI
- **THEN** one response identifies that installed package and version, reports topic `author-revise`, and contains both the common workflow router and the complete author-revise guidance
- **AND** The response remains offline and package-owned, and does not read project configuration, write files, install packages, validate a project, or execute evidence

<!-- focused-spec:id=guidance.delivery.combined-router-only -->
#### Scenario: Workflow-only request does not append an operation topic
- **WHEN** a consumer requests the default `workflow` topic
- **THEN** one response identifies the serving package/version, reports topic `workflow`, and contains the common router without appending an unrelated operation topic

<!-- focused-spec:id=guidance.delivery.combined-invalid-preserves-validation -->
#### Scenario: Combined response preserves protocol and version rejection
- **WHEN** a consumer requests an operation topic with an unsupported protocol or an invalid topic
- **THEN** the CLI rejects the request with no usable guidance on stdout and an actionable compatibility or usage diagnostic
- **AND** The CLI SHALL NOT return a combined response with a silently substituted protocol, topic, package identity, or version

### Requirement: Plugin-independent shared guidance
Router/shared topics SHALL retain package-owned contracts and verification boundaries without plugin catalogs, dialects or framework procedures. They SHALL direct explicit installed plugin-doc requests with provenance; composing plugins SHALL document separate nested requests, not core discovery. The loader SHALL contain only activation/routing. Each operation response SHALL include its common router, requiring no extra workflow request.

<!-- focused-spec:id=guidance.plugins.public-contracts -->
#### Scenario: Agent-facing contracts come from selected installed plugins
- **WHEN** an agent uses the shared guidance to acquire documentation for a selected composing format and its parser
- **THEN** the installed CLI supplies each package's independently owned complete contract through explicit requests without a core-maintained plugin allowlist, plugin imports, or automatic nested aggregation

<!-- focused-spec:id=guidance.plugins.router -->
#### Scenario: The loader routes to package-owned focused guidance
- **WHEN** an agent loads the installed skill for a focused-spec workflow step and the router selects a review, author-revise, upgrade, or verify operation
- **THEN** the agent requests that topic from the same selected installed CLI rather than relying on procedure embedded in the loader or a truncated workflow response

<!-- focused-spec:id=guidance.plugins.operation-with-router -->
#### Scenario: An operation response supplies its routing context
- **WHEN** an agent requests an operation topic such as `review` from the selected installed CLI
- **THEN** it receives the common router and complete operation guidance in that response and can follow their shared provenance and plugin-contract procedures without a separate router acquisition
- **AND** Additional format or runner topic requests and selected plugin-document requests remain separate when the task requires those contracts
