## 1. Contract tests

- [x] 1.1 Add focused static contracts for all three tool selectors, provider refresh, reference submission, and history typing.

## 2. Shared CLI engine behavior

- [x] 2.1 Add provider discovery, eligible-provider filtering, persisted selection, and missing-configuration guidance to each tool.
- [x] 2.2 Route CLI submissions from each tool through `/api/online-image` with the selected provider, default model, source references, and tool history type.

## 3. Tool UI integration

- [x] 3.1 Add CLI source controls to detail enhancement and angle control without changing their existing local and ModelScope paths.
- [x] 3.2 Extend image editing's engine panel with CLI selection and preserve primary plus optional image references.

## 4. Verification

- [x] 4.1 Run focused contracts, Python syntax validation, and strict OpenSpec validation.
- [x] 4.2 Review all spec scenarios and verify the configured CLI controls in the browser without submitting a billable generation request.
