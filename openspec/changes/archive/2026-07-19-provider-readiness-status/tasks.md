## 1. Readiness tests

- [x] 1.1 Add regression coverage for the provider API readiness flag and configured card checkmark.
- [x] 1.2 Update local image selector tests to require backend readiness filtering.

## 2. Backend readiness contract

- [x] 2.1 Add `image_configured` to provider API and save responses using credential and local CLI readiness.

## 3. User interface

- [x] 3.1 Filter text-to-image and shared image-tool selectors by `image_configured`.
- [x] 3.2 Render a visible configured checkmark on ready API provider cards and refresh resource versions.

## 4. Verification

- [x] 4.1 Run focused tests and syntax checks.
- [x] 4.2 Restart the local application, verify only ready image providers appear, and confirm the configured checkmark in API settings.
