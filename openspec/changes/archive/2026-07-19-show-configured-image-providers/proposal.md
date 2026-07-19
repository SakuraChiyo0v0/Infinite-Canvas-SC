## Why

The local image tools receive valid configured image providers from `/api/providers`, but protocol-specific browser filtering can still leave the selector empty. This causes the UI to claim that no image API is configured even when GPT CLI or a custom API is ready to use.

## What Changes

- Use one availability rule for remote image-engine selectors: an enabled provider with at least one configured image model is selectable.
- Apply the rule consistently to text-to-image, detail enhancement, image editing, and angle control.
- Keep the empty state only for the genuine case where no enabled image provider is configured.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-cli-image-generation`: Remote text-to-image choices show every enabled provider with a configured image model.
- `cli-image-tool-editing`: Remote choices in all local image tools use the same provider availability rule.

## Impact

Updates the shared local-image selector helper, the text-to-image selector, their tests, and versioned local-function page resources.
