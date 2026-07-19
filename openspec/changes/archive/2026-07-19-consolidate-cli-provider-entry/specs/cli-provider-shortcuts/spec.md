## ADDED Requirements

### Requirement: CLI providers have a single API-settings entry point
The API settings sidebar SHALL show each configured CLI provider only in the platform list. Selecting that platform card MUST open the provider's existing configuration editor and status information.

#### Scenario: Viewing configured CLI providers
- **WHEN** a user opens API settings with 即梦 CLI, GPT CLI, and Antigravity CLI configured
- **THEN** each CLI provider appears once in the platform list
- **AND** no duplicate CLI shortcut list is displayed below the platform actions

#### Scenario: Editing a CLI provider
- **WHEN** a user selects a CLI provider card from the platform list
- **THEN** its existing CLI configuration editor and status information are displayed

## REMOVED Requirements

### Requirement: CLI shortcut dimensions match provider cards
**Reason**: Fixed CLI shortcut buttons duplicate the dynamic platform cards and create two entry points for the same providers.

**Migration**: Select the CLI provider's platform card in the platform list; it opens the same provider configuration.
