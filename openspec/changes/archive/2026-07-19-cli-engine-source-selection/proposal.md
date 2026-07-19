## Why

The local text-to-image screen exposes only ComfyUI and ModelScope as engine sources, even when local CLI image providers have been configured in API settings. Users therefore cannot select an installed 即梦 CLI, GPT CLI, or Antigravity CLI from the generation workflow that they use for local images.

## What Changes

- Add a CLI engine source to the local text-to-image screen.
- List enabled, image-capable local CLI providers configured in API settings and allow the user to select one.
- Submit CLI image requests through the existing provider-aware image endpoint, preserving the selected provider, model, dimensions, and zimage history type.
- Explain how to configure a CLI source when no eligible CLI provider exists.

## Capabilities

### New Capabilities

- `local-cli-image-generation`: Select and invoke configured local CLI image providers from the local text-to-image engine source control.

### Modified Capabilities

- None.

## Impact

- Affects `static/zimage.html` source selection, provider discovery, and image generation requests.
- Extends the existing online-image request payload in `main.py` so CLI-generated images are retained in zimage history.
- Uses existing configured CLI providers and their local authentication; no new third-party service or credential storage is introduced.
