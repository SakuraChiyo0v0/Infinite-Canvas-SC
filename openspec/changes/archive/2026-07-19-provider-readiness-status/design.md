## Context

The provider list contains default models before credentials or local CLI dependencies are usable. Browser code cannot reliably determine whether a CLI is installed or logged in, so it previously inferred readiness from model presence alone.

## Goals / Non-Goals

**Goals:**

- Expose one backend-owned image readiness flag for every provider.
- Use it consistently for the API settings indicator and all local image-engine selectors.

**Non-Goals:**

- Run a paid image request as a readiness check.
- Change credential storage or perform provider login automatically.

## Decisions

- `/api/providers` and provider-save responses include `image_configured`. It requires an enabled provider and at least one image model, plus saved credentials for API providers or verified local dependencies for CLI providers.
- CLI readiness is evaluated by the existing local status checks: Codex requires the Codex CLI and GPT Image helper; 即梦 requires installation, a supported version, and a login; Antigravity requires its CLI executable. Non-CLI providers require their applicable stored key material.
- Selectors filter on `image_configured === true`; platform cards render a small green checkmark only when the same flag is true.

## Risks / Trade-offs

- [CLI login may expire after a successful local dependency check] → The actual generation request still reports a provider-specific authentication error.
- [Status checks take time] → The endpoint performs only local checks and does not make upstream image-generation requests.
