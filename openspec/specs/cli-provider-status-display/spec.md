# cli-provider-status-display Specification

## Purpose
TBD - created by archiving change fix-cli-provider-availability. Update Purpose after archive.
## Requirements
### Requirement: CLI providers show local authentication status
The API settings provider list MUST label an enabled `jimeng`, `codex`, or `gemini-cli` provider with no Base URL as using a local CLI login state rather than showing an unconfigured-address warning. When the provider reports `image_configured: true`, its card MUST display a visible configured checkmark.

#### Scenario: Viewing a configured GPT CLI provider
- **WHEN** the API settings provider list displays a GPT CLI provider with an empty Base URL and `image_configured: true`
- **THEN** its metadata identifies the local CLI login state
- **AND** its card displays a configured checkmark
- **AND** it does not display “未配置地址”

### Requirement: Provider API reports image readiness
The provider API MUST return an `image_configured` boolean for every provider. It MUST be true only when the provider is enabled, has at least one image model, and has its required credential or local CLI dependency available.

#### Scenario: A local CLI is not installed
- **WHEN** an enabled CLI provider has default image models but its required local executable is unavailable
- **THEN** the provider API returns `image_configured: false`
- **AND** local image selectors do not list that provider

#### Scenario: An API provider has no credential
- **WHEN** an enabled API provider has image models but no required saved credential
- **THEN** the provider API returns `image_configured: false`
- **AND** its provider card does not display a configured checkmark
