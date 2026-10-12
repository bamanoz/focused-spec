# Spec Delta

## ADDED Requirements

### Requirement: Public installed runner contracts

Each official runner package SHALL make its selector syntax, supported framework and command options available as public package documentation, independently of source-checkout access. Consumers SHALL be able to select and execute real evidence from documented examples without inspecting plugin implementation.

<!-- focused-spec:id=distribution.runner.public-contracts -->
#### Scenario: Installed documentation supplies executable selectors
- **WHEN** a consumer installs independently packed official runner packages and chooses selectors from their public documentation
- **THEN** the documented selectors resolve and execute the selected real tests, and a controlled product regression makes that evidence fail rather than pass
