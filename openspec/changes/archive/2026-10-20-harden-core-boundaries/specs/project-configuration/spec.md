## ADDED Requirements

### Requirement: Format responses survive transport without repair
Format parsing and binding responses SHALL be JSON-compatible before serialization. Invalid values and fields SHALL NOT disappear or change into valid responses through transport. Rejection SHALL occur before runner resolution or execution; existing shape and global enrollment validation SHALL remain enforced.

<!-- focused-spec:id=format.response.lossless -->
#### Scenario: Serialization cannot conceal an invalid format response
- **WHEN** a selected format returns a parse or bind response containing non-JSON values or a field that serialization would remove
- **THEN** validation reports a format violation and no runner resolves or executes, while valid parse and bind responses retain their enrollments
