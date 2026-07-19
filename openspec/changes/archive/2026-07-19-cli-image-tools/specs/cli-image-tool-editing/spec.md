## ADDED Requirements

### Requirement: Local image tools expose configured CLI image providers
The detail enhancement, image editing, and angle-control screens SHALL expose a CLI engine source alongside their existing engines. Each screen MUST list enabled `jimeng`, `codex`, or `gemini-cli` providers that have at least one configured image model, and refresh that list when provider settings change.

#### Scenario: Eligible providers are configured
- **WHEN** a user opens any of the three local image tools and API settings contain eligible GPT CLI or 即梦 CLI providers
- **THEN** the user can select the CLI engine
- **AND** the provider selector lists each eligible configured provider and its default image model

#### Scenario: No eligible provider is configured
- **WHEN** a user selects CLI in one of the local image tools and no eligible CLI provider is configured
- **THEN** the screen explains that a CLI image provider must be configured in API settings
- **AND** it does not submit a generation request

### Requirement: CLI engine uses each tool's uploaded images as references
The CLI engine SHALL submit each tool's locally uploaded images to `/api/online-image` as reference images using the selected provider and default image model. Detail enhancement and angle control MUST require their source image; image editing MUST require its primary image and include populated optional reference slots.

#### Scenario: Detail enhancement via CLI
- **WHEN** the user uploads an image, selects a configured CLI provider, and starts detail enhancement
- **THEN** the request includes the uploaded image as a reference and an enhancement instruction
- **AND** the returned image is displayed in the enhancement result view

#### Scenario: Image editing via CLI
- **WHEN** the user uploads a primary image and optional reference images, selects a configured CLI provider, and starts image editing
- **THEN** the request includes the primary image and every populated optional image reference
- **AND** the returned image is displayed in the image-edit result view

#### Scenario: Angle control via CLI
- **WHEN** the user uploads an image, enters an angle instruction, selects a configured CLI provider, and starts angle control
- **THEN** the request includes the uploaded image as a reference and the entered instruction
- **AND** the returned image is displayed in the angle-control result view

### Requirement: CLI results remain in the corresponding tool history
The CLI engine MUST submit the existing history type for its tool so that results remain visible after a page reload.

#### Scenario: Reload after CLI generation
- **WHEN** a CLI generation finishes from detail enhancement, image editing, or angle control
- **THEN** its history record is typed `enhance`, `klein`, or `angle` respectively
- **AND** the corresponding tool's history gallery displays that result after reload
