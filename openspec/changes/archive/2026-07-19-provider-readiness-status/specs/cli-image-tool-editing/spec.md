## MODIFIED Requirements

### Requirement: Local image tools expose configured CLI image providers
The detail enhancement, image editing, and angle-control screens SHALL expose a remote engine source alongside their existing engines. Each screen MUST list only providers whose API status reports `image_configured: true` and that have at least one configured image model, and refresh that list when provider settings change.

#### Scenario: Eligible providers are configured
- **WHEN** a user opens any of the three local image tools and API settings reports GPT CLI or 即梦 CLI as image-configured
- **THEN** the user can select the remote engine
- **AND** the provider selector lists each configured CLI provider and its default image model

#### Scenario: Eligible custom API provider is configured
- **WHEN** a user adds an enabled custom API provider with at least one image model and `image_configured: true` in API settings
- **THEN** every local image tool's remote provider selector lists that provider and its default image model after loading or receiving a provider-settings update
- **AND** the user can select it for generation

#### Scenario: No eligible provider is configured
- **WHEN** a user selects the remote engine in one of the local image tools and no provider reports `image_configured: true`
- **THEN** the screen explains that an image provider must be configured in API settings
- **AND** it does not submit a generation request
