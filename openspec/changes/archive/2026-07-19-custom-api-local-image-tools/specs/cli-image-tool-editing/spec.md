## MODIFIED Requirements

### Requirement: Local image tools expose configured CLI image providers
The detail enhancement, image editing, and angle-control screens SHALL expose a remote engine source alongside their existing engines. Each screen MUST list enabled `jimeng`, `codex`, or `gemini-cli` providers and enabled custom API providers that have at least one configured image model, and refresh that list when provider settings change. The built-in `modelscope`, `runninghub`, and `volcengine` providers MUST NOT be presented as custom API choices.

#### Scenario: Eligible providers are configured
- **WHEN** a user opens any of the three local image tools and API settings contain eligible GPT CLI or 即梦 CLI image providers
- **THEN** the user can select the remote engine
- **AND** the provider selector lists each eligible configured CLI provider and its default image model

#### Scenario: Eligible custom API provider is configured
- **WHEN** a user adds an enabled custom API provider with at least one image model in API settings
- **THEN** every local image tool's remote provider selector lists that provider and its default image model after loading or receiving a provider-settings update
- **AND** the user can select it for generation

#### Scenario: No eligible provider is configured
- **WHEN** a user selects the remote engine in one of the local image tools and no eligible CLI or custom API provider is configured
- **THEN** the screen explains that an image provider must be configured in API settings
- **AND** it does not submit a generation request
