## Context

The enhancement screen uses ComfyUI workflows only, image editing uses ComfyUI or ModelScope, and angle control uses ComfyUI or a ModelScope-specific endpoint. All three upload user images locally. The existing provider-aware `/api/online-image` endpoint already accepts `reference_images` data URLs, routes `jimeng`, `codex`, and `gemini-cli` providers, stores results, and supports caller-selected history types.

## Goals / Non-Goals

**Goals:**

- Offer a third `CLI` engine and persisted eligible-provider selection in all three local image tools.
- Send each uploaded source image as a CLI reference image while keeping the tools' local and ModelScope behavior unchanged.
- Save CLI results under each tool's existing history type.

**Non-Goals:**

- Recreate ComfyUI-only controls such as enhancement strength, 4K upscaling, or Klein LoRA in CLI prompts.
- Add CLI installation, authentication, provider configuration, masks, or model management to these pages.
- Change provider-specific image-generation implementation or introduce a new backend endpoint.

## Decisions

- Each page fetches `/api/providers` and filters enabled providers with a configured image model and a `jimeng`, `codex`, or `gemini-cli` protocol, matching the existing text-to-image behavior. The selected provider is persisted per tool to avoid a global choice silently changing unrelated workflows.
- CLI requests use `/api/online-image` with the selected provider's first image model and `reference_images` encoded from the locally previewed upload. Data URLs are already accepted by all supported local CLI adapters, avoiding a new public-file endpoint or server-side upload conversion.
- Enhancement sends a conservative enhancement instruction plus its source image. Image editing sends its primary image and any additional reference slots; angle control sends its source image and the existing angle prompt. This preserves the semantic intent of each workflow while relying on each CLI's edit capability.
- CLI requests set `history_type` to `enhance`, `klein`, or `angle`; existing gallery history fetches therefore keep working without a separate storage path.
- Existing `providers-changed` messages refresh the open page's selector. The selector remains visible with setup guidance when no eligible provider exists and blocks generation before any request is sent.

## Risks / Trade-offs

- [Some configured CLI image providers do not support editing] → The existing provider error is shown to the user; no false compatibility claim is made.
- [Data URL uploads can be large] → Source images are limited to the tool's existing upload flow and the endpoint's established reference handling.
- [CLI output is not a deterministic upscale or geometric transform] → CLI mode is labeled as an image-edit generation route; ComfyUI remains available for deterministic workflows.

## Migration Plan

No migration is required. Local and ModelScope remain the default engine selections; CLI selection is opt-in and separately stored by tool. Reverting removes the new UI path without altering saved histories.

## Open Questions

None.
