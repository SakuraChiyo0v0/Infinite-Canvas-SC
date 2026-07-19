## Why

Configured local CLI image providers are available in text-to-image, but the other local image workflows still only offer ComfyUI or ModelScope. Users cannot use the same local CLI setup for detail enhancement, image editing, or angle control.

## What Changes

- Add CLI provider selection to detail enhancement, image editing, and angle control.
- Submit each tool's uploaded image or images as provider-aware image references through the existing image endpoint.
- Preserve each tool's existing local and ModelScope paths and retain CLI results in that tool's history.

## Capabilities

### New Capabilities

- `cli-image-tool-editing`: Use eligible configured local CLI image providers for enhancement, multi-image editing, and angle-control workflows.

### Modified Capabilities

- None.

## Impact

- Affected UI: `static/enhance.html`, `static/klein.html`, `static/angle.html`.
- Uses the existing `/api/providers`, `/api/upload`, and `/api/online-image` integration; no new external service or database migration is required.
