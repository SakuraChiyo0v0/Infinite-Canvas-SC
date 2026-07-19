## MODIFIED Requirements

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
