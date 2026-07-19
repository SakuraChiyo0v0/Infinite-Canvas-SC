## 1. Command construction test

- [x] 1.1 Add a regression test that requires the supported Skill wrapper and explicit output argument.

## 2. GPT Image 2 Skill invocation

- [x] 2.1 Prefer the local Node Skill wrapper over a Windows command-script shim.
- [x] 2.2 Build the generation command from the resolved command list and preserve `--out`.

## 3. Verification

- [x] 3.1 Run the focused regression tests and Python syntax check.
- [x] 3.2 Restart the service and run the non-generating Skill doctor command through the resolved wrapper.
