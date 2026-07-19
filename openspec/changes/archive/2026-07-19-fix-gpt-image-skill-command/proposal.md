## Why

GPT CLI image generation invokes a Windows command-script shim directly, causing the GPT Image 2 Skill to report that its required output argument is missing despite the application creating an output path.

## What Changes

- Invoke the GPT Image 2 Skill through its supported Node wrapper when available.
- Pass the output path through the wrapper as the documented `--out` argument for image generation and editing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-cli-image-generation`: GPT CLI image requests reliably invoke the configured image helper with an output destination.

## Impact

Updates the GPT Image 2 Skill command construction and its regression test.
