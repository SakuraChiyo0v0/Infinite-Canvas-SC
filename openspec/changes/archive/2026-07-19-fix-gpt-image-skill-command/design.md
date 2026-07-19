## Context

On Windows, Python resolves the installed GPT Image 2 CLI to a `.cmd` shim. Direct process invocation through that shim can lose the generated output-path argument before it reaches the underlying binary.

## Goals / Non-Goals

**Goals:**

- Preserve all documented GPT Image 2 Skill arguments, especially `--out`.
- Use the Skill's supported Node wrapper when it is installed locally.

**Non-Goals:**

- Generate a paid test image during verification.
- Change provider authentication, prompts, models, or output image processing.

## Decisions

- Build the subprocess command as an executable-and-arguments list. Prefer `node <skill>/scripts/gpt_image_2_skill.cjs`; retain the configured or discovered CLI executable as a fallback.
- Keep the existing per-request output path and pass it directly after `--out` for both generate and edit commands.

## Risks / Trade-offs

- [The local Skill folder is unavailable] → Fall back to the configured/discovered executable and retain the explicit `--out` argument.
- [A wrapper/runtime mismatch exists] → Use the wrapper's `doctor` command as the non-generating verification path.
