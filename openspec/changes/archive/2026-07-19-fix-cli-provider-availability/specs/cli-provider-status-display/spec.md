## ADDED Requirements

### Requirement: CLI providers show local authentication status
The API settings provider list MUST label an enabled `jimeng`, `codex`, or `gemini-cli` provider with no Base URL as using a local CLI login state rather than showing an unconfigured-address warning.

#### Scenario: Viewing a configured GPT CLI provider
- **WHEN** the API settings provider list displays a GPT CLI provider with an empty Base URL
- **THEN** its metadata identifies the local CLI login state
- **AND** it does not display “未配置地址”
