## ADDED Requirements

### Requirement: CLI image providers are discoverable as an engine source
The local text-to-image screen SHALL provide a CLI engine source alongside the existing local and ModelScope sources. It MUST list enabled API providers that use the `jimeng`, `codex`, or `gemini-cli` protocol and have at least one configured image model.

#### Scenario: Configured CLI providers are available
- **WHEN** the local text-to-image screen loads and API settings contain enabled GPT CLI and 即梦 CLI image providers
- **THEN** the user can select CLI as the engine source
- **AND** the CLI provider selector lists GPT CLI and 即梦 CLI

#### Scenario: CLI provider configuration changes
- **WHEN** API settings reports that provider configuration has changed while the local text-to-image screen is open
- **THEN** the CLI provider selector refreshes to reflect the current eligible providers

#### Scenario: No CLI image provider is configured
- **WHEN** the user selects CLI as the engine source and no enabled CLI image provider is available
- **THEN** the screen explains that a CLI image provider must first be added in API settings
- **AND** it does not submit an image-generation request

### Requirement: Selected CLI provider generates local text-to-image output
The local text-to-image screen SHALL submit a CLI-source generation request to the provider-aware image endpoint using the selected provider ID, that provider's configured default image model, the entered prompt, and the requested dimensions.

#### Scenario: Generate with a selected CLI provider
- **WHEN** the user selects an eligible CLI provider, enters a prompt, and starts generation
- **THEN** the request uses that provider ID and its first configured image model
- **AND** the returned image is displayed in the local text-to-image gallery

### Requirement: CLI output is retained in zimage history
The provider-aware image endpoint MUST preserve a caller-provided history type, defaulting to `online` when it is omitted.

#### Scenario: zimage submits a CLI generation
- **WHEN** the local text-to-image screen submits a CLI generation with history type `zimage`
- **THEN** the returned history record has type `zimage`
- **AND** the image remains available through the zimage history flow after a page reload
