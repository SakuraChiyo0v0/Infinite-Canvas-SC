## Why

The interface currently treats default models and enabled flags as proof that a provider is usable. This presents uninstalled or unauthenticated CLIs and API providers without credentials as selectable engines.

## What Changes

- Return a backend-owned `image_configured` status for each provider based on its saved credentials or local CLI readiness.
- Restrict local image-engine selectors to enabled providers with image models and `image_configured: true`.
- Display a visible checkmark on configured provider cards in API settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-cli-image-generation`: Text-to-image only lists configured image providers.
- `cli-image-tool-editing`: All local image tools only list configured image providers.
- `cli-provider-status-display`: Provider cards show a configured status indicator based on the backend status.

## Impact

Updates the provider API response, local image selector helpers, API settings cards and styles, and related tests.
