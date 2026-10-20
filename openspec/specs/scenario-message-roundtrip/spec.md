# scenario-message-roundtrip Specification

## Purpose
Reuse the canonical executable bank scenarios as concrete message examples for checking the consumer's serializer independently of its in-memory business decisions.

## Requirements

### Requirement: Reuse canonical scenario messages
Both bank consumers SHALL roundtrip every history event in Given, the command in When and every expected event in Expect through their consumer-owned message codec. Checks SHALL compare the decoded message exactly with the original typed or structural value and identify the scenario, section and message position on failure. They SHALL NOT maintain a copied message fixture set.

<!-- focused-spec:id=scenario-message-roundtrip.canonical-messages -->
#### Scenario: All authored messages survive the consumer codec
- **WHEN** the standalone bank serialization checks process the existing six-scenario suite
- **THEN** every Given event, When command and Expect event is encoded, decoded and exactly compared using the bank's codec with its original amount, event type and reason intact

### Requirement: Serialization checks are independent of business verification
Roundtrip checks SHALL remain separate from driver execution and SHALL NOT rewrite canonical declarations, expectations or business observations to compensate for codec behavior. They SHALL work without focused-spec configuration or optional format and runner packages.

<!-- focused-spec:id=scenario-message-roundtrip.independent -->
#### Scenario: Codec checks leave reusable business scenarios unchanged
- **WHEN** standalone serialization checks run against the bank suite
- **THEN** they do not prepare or execute the account, leave all declared messages unchanged and require neither focused-spec configuration nor plugins

### Requirement: Lossy serialization is observable
A codec that loses or changes an authored message field SHALL fail the roundtrip check even if the in-memory application still satisfies all business scenarios. Both bank demos SHALL expose the separate roundtrip outcome and exit unsuccessfully when it fails. A successful roundtrip SHALL NOT be presented as proof of compatibility with historical message versions.

<!-- focused-spec:id=scenario-message-roundtrip.loss-detected -->
#### Scenario: Lost decline reason fails serialization without a business regression
- **WHEN** a controlled change makes the consumer codec lose the insufficient-funds reason while leaving account behavior intact
- **THEN** the separate serialization check fails on that field and identifies its scenario message while the ordinary in-memory business verification still passes
