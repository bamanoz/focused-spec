# Spec Delta

## MODIFIED Requirements

### Requirement: Independently installed adapters
Core SHALL expose Format API 2 without native parsers, inline authoring, evidence-storage adapters or test frameworks. Official Markdown, Gherkin, inline and registry formats and runners SHALL install independently as compiled ESM with declarations. Workspace installs SHALL use local packages without publication. The packed .NET format SHALL omit unused localized Roslyn satellites and retain assemblies required for supported C# parsing.

<!-- focused-spec:id=distribution.adapters.independent -->
#### Scenario: Core-only and adapter consumer installations
- **WHEN** a consumer installs the core alone and later installs selected format and runner packages
- **THEN** the first installation has no parser dependencies or fallback, and the selected packages enable native evidence execution independently of the source checkout

<!-- focused-spec:id=distribution.adapters.inline-registry -->
#### Scenario: Packed inline and registry consumers are independent
- **WHEN** disposable consumers install independently packed inline and registry adapters and select their documented formats
- **THEN** inline evidence executes with no registry and external native evidence executes through the explicit registry adapter, without source-checkout access or implicit core parser dependencies

<!-- focused-spec:id=distribution.adapters.roslyn-resources -->
#### Scenario: Packed .NET format excludes unused localized compiler resources
- **WHEN** the .NET scenario format package is built and packed
- **THEN** it contains the required compiler/runtime assemblies and English resources, but no unused localized Roslyn satellite resource assemblies
