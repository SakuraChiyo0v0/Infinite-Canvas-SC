## Why

CLI providers are displayed once as configured platform cards and again as CLI shortcut buttons, creating a duplicated configuration entry point.

## What Changes

- Keep configured CLI providers in the platform list as their single API-settings entry point.
- Remove the duplicate CLI shortcut section and its installation note from the sidebar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-provider-shortcuts`: Replace duplicate CLI shortcuts with the unified platform-list entry point.

## Impact

Updates the API settings sidebar markup, obsolete shortcut layout test, and its specification.
