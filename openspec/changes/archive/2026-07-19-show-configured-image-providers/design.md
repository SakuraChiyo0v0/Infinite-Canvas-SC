## Context

The API endpoint already reports whether a provider is enabled and lists its configured image models. The browser duplicated protocol and built-in-provider categorisation, which diverged from the endpoint's availability data and produced a false empty state.

## Goals / Non-Goals

**Goals:**

- Use the API response as the source of truth for whether a provider can be selected for image generation.
- Use the same rule in all local image tool selectors.

**Non-Goals:**

- Change provider credentials, endpoint validation, model discovery, or image-generation requests.
- Add support for providers without an image model.

## Decisions

- Select a provider when it is enabled and has a non-empty `image_models` array. These are the two fields the backend has already validated for the UI contract.
- Retire browser-side protocol and provider-ID exclusions. They added a second source of truth and were the direct cause of valid providers disappearing.
- Preserve the existing empty state for a genuinely empty eligible list.

## Risks / Trade-offs

- [A provider is marked enabled with an unusable model] → The existing API validation and request error handling remain responsible for reporting that provider-specific failure.
- [The list contains more valid providers than the previous CLI-only label implied] → The selector label describes its role as a remote image API choice rather than asserting a protocol restriction.
