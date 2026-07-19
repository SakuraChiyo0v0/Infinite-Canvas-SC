## MODIFIED Requirements

### Requirement: Selected CLI provider generates local text-to-image output
The local text-to-image screen SHALL submit a CLI-source generation request to the provider-aware image endpoint using the selected provider ID, that provider's configured default image model, the entered prompt, and the requested dimensions. For GPT CLI image requests, the server MUST invoke the GPT Image 2 Skill through its supported command wrapper when available and MUST pass a writable output file path with `--out`.

#### Scenario: Generate with a selected CLI provider
- **WHEN** the user selects an eligible CLI provider, enters a prompt, and starts generation
- **THEN** the request uses that provider ID and its first configured image model
- **AND** the returned image is displayed in the local text-to-image gallery

#### Scenario: GPT CLI command receives an output path
- **WHEN** GPT CLI starts an image-generation or image-edit request
- **THEN** the GPT Image 2 Skill command includes `--out` followed by the generated output path
- **AND** it does not fail because an output argument is missing
