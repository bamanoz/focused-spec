# Spec Delta

## ADDED Requirements

### Requirement: Expanded layout alternatives remain path-safe
Every document and exclusion pattern SHALL be checked after expansion as well as before expansion. No expanded alternative may be absolute, contain a parent-directory segment, or otherwise escape the selected project root; unsafe configuration SHALL fail before matching or loading a runner.

<!-- focused-spec:id=config.glob.expanded-path-safety -->
#### Scenario: Brace expansion introduces a parent segment
- **WHEN** a configured document or exclusion pattern such as `{..,safe}/spec.md` expands to an alternative containing a parent-directory segment
- **THEN** configuration validation rejects the pattern with an actionable violation before filesystem matching

<!-- focused-spec:id=config.glob.expanded-absolute-safety -->
#### Scenario: Brace expansion introduces an absolute path
- **WHEN** a configured document or exclusion pattern expands to an absolute path
- **THEN** configuration validation rejects the pattern before matching and does not scan or report paths outside the project root

### Requirement: Captured scopes follow the matching expanded layout
A document matched by a captured-scope layout SHALL receive the scope captured by the specific expanded alternative that matched its project-relative path, including when other glob alternatives contain path separators.

<!-- focused-spec:id=config.source.expanded-capture-scope -->
#### Scenario: Brace alternative has a different number of path segments
- **WHEN** a captured-scope layout contains brace alternatives with different path segment counts and a document matches one alternative
- **THEN** the document is assigned the scope fragment from that matching alternative rather than a scope inferred from the unexpanded pattern

### Requirement: Migration guidance uses the selected executable's upgrade topic
Diagnostics for obsolete configuration or format APIs SHALL identify the upgrade topic and give guidance that works with the selected CLI installation, without assuming a project-local npm binary path or directing users to the workflow topic.

<!-- focused-spec:id=config.migration.selected-cli-upgrade -->
#### Scenario: Obsolete configuration is encountered under a non-local CLI installation
- **WHEN** configuration validation rejects a legacy version while the selected CLI is globally installed or provided through a workspace
- **THEN** the diagnostic directs the user to acquire the `upgrade` topic from that selected executable and does not prescribe an invalid project-local binary path
