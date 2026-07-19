# local-cli-image-generation Specification

## Purpose
TBD - created by archiving change cli-engine-source-selection. Update Purpose after archive.
## Requirements
### Requirement: CLI image providers are discoverable as an engine source
The local text-to-image screen SHALL provide a remote engine source alongside the existing local and ModelScope sources. It MUST list only providers whose API status reports `image_configured: true` and that have at least one configured image model. The parent local-functions page MUST load the current text-to-image resource version so the selector reflects these rules.

#### Scenario: Configured CLI providers are available
- **WHEN** the local text-to-image screen loads and API settings reports GPT CLI and 即梦 CLI as image-configured
- **THEN** the user can select CLI as the engine source
- **AND** the provider selector lists GPT CLI and 即梦 CLI

#### Scenario: CLI provider configuration changes
- **WHEN** API settings reports that provider configuration has changed while the local text-to-image screen is open
- **THEN** the CLI provider selector refreshes to reflect the current image-configured providers

#### Scenario: No CLI image provider is configured
- **WHEN** the user selects CLI as the engine source and no provider reports `image_configured: true`
- **THEN** the screen explains that an image provider must first be configured in API settings
- **AND** it does not submit an image-generation request

#### Scenario: Configured custom API is available
- **WHEN** API settings contains an enabled custom API provider with an image model and `image_configured: true`
- **THEN** the remote provider selector lists that provider and its default image model
- **AND** the user can select it for local text-to-image generation

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

### Requirement: CLI output is retained in zimage history
The provider-aware image endpoint MUST preserve a caller-provided history type, defaulting to `online` when it is omitted.

#### Scenario: zimage submits a CLI generation
- **WHEN** the local text-to-image screen submits a CLI generation with history type `zimage`
- **THEN** the returned history record has type `zimage`
- **AND** the image remains available through the zimage history flow after a page reload
