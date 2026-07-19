## Context

`static/zimage.html` currently offers two fixed source modes: local ComfyUI and ModelScope. API settings already persists provider records for 即梦 CLI, OpenAI Codex CLI, and Antigravity CLI, and the backend's provider-aware `/api/online-image` endpoint already routes image generation to each of those protocols. The zimage screen neither discovers those providers nor sends requests to that endpoint.

## Goals / Non-Goals

**Goals:**

- Let users choose a configured local CLI image provider from the zimage engine source control.
- Keep ComfyUI and ModelScope behavior unchanged.
- Preserve zimage history and real-time updates for CLI-generated images.
- Make missing CLI configuration actionable from the UI.

**Non-Goals:**

- Installing, authenticating, or configuring CLI tools from the zimage screen.
- Adding a model-management UI; the selected provider's configured default image model is used.
- Supporting image editing or reference-image uploads in this text-to-image screen.

## Decisions

- Add a third `CLI` source mode with a provider dropdown. The dropdown is populated from enabled API providers whose protocol is `jimeng`, `codex`, or `gemini-cli` and which expose at least one image model. This keeps provider setup centralized in API settings and supports multiple installed CLIs without hard-coding provider IDs.
- Refresh that dropdown when the existing `providers-changed` frame message is received, so updates made in API settings are visible without a full page reload.
- Submit selected CLI requests to `/api/online-image` rather than extending the ComfyUI-only `/api/generate` request. The endpoint already validates providers, invokes the correct local CLI implementation, stores output files, and broadcasts results.
- Add an optional history type to `OnlineImageRequest`. zimage sends `zimage`, while every other client retains the existing `online` default. This makes CLI output appear in zimage history after reload without changing other consumers.
- Keep CLI source selectable when no provider is configured, but show a configuration message instead of issuing a request. Hiding it would recreate the discoverability problem that prompted this change.

## Risks / Trade-offs

- [A configured CLI cannot generate images, such as Codex without the GPT Image helper] → The backend returns its existing actionable provider error and the zimage screen surfaces it.
- [A provider has multiple image models] → The screen uses the first configured model; users manage the ordered model list in API settings.
- [CLI operations can take longer than ComfyUI] → The existing endpoint's provider-specific timeouts remain authoritative and the zimage button stays in its loading state until the request completes.

## Migration Plan

No data migration is required. Existing saved `zimage_engine_mode` values continue to map to local and ModelScope modes; CLI selection is saved separately after a user chooses it.

## Open Questions

None.
