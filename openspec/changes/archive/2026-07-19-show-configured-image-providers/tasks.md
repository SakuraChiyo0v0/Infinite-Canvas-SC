## 1. Provider discovery tests

- [x] 1.1 Update text-to-image selector tests to require the availability-based provider rule.
- [x] 1.2 Update shared local image-tool selector tests to require the same rule.

## 2. Provider selector implementation

- [x] 2.1 Replace protocol-specific filtering in text-to-image with the enabled-image-model availability rule.
- [x] 2.2 Replace protocol-specific filtering in the shared local image-tool helper and refresh versioned resources.

## 3. Verification

- [x] 3.1 Run focused tests and static syntax checks.
- [x] 3.2 Reload the running application and verify GPT CLI appears in the remote engine selector.
