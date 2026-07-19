## Why

The CLI shortcut buttons in the API settings sidebar are visibly smaller than the platform action buttons above them. This makes the sidebar hierarchy feel inconsistent and makes the CLI actions less prominent than their peer actions.

## What Changes

- Make each CLI shortcut button use the same outer height and corner radius as the sidebar's provider cards.
- Preserve the CLI shortcut buttons' existing labels, icons, ordering, and click behavior.

## Capabilities

### New Capabilities

- `cli-provider-shortcuts`: Provide consistently sized CLI provider shortcut controls in the API settings sidebar.

### Modified Capabilities

- None.

## Impact

- Affects the API settings sidebar stylesheet in `static/css/api-settings.css`.
- No API, provider configuration, or dependency changes.
