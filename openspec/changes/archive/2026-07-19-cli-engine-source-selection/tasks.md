## 1. Contract tests

- [x] 1.1 Add focused frontend and backend source-contract tests for CLI provider discovery, request routing, and zimage history typing.

## 2. CLI source selection

- [x] 2.1 Add the CLI source control and configured CLI provider selector to the local text-to-image screen.
- [x] 2.2 Discover eligible configured CLI providers, persist the selection, and show configuration guidance when none are available.
- [x] 2.3 Route CLI generation through the provider-aware image endpoint using the selected provider and default model.

## 3. History integration

- [x] 3.1 Extend online-image requests to retain an optional caller-provided history type without changing the existing default.

## 4. Verification

- [x] 4.1 Run focused contract tests, Python syntax validation, and strict OpenSpec validation.
- [x] 4.2 Review the implementation against all spec scenarios and perform browser verification with configured CLI state plus automated missing-state coverage.
