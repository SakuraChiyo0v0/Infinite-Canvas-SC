## Context

Configured CLI providers already render as platform cards with their status and configuration editor. A second fixed shortcut list repeats the same three providers below the platform list.

## Goals / Non-Goals

**Goals:**

- Make the platform card the single entry point for each configured CLI provider.
- Reduce sidebar height without changing provider configuration behavior.

**Non-Goals:**

- Change CLI installation, detection, credentials, models, or provider ordering.

## Decisions

- Remove the duplicate fixed shortcut markup and its associated styling. The dynamic platform list already renders the current configured providers and selects each provider's existing editor.
- Retain the add-platform and recommended-API actions.

## Risks / Trade-offs

- [A user expects the old shortcut buttons] → Each CLI provider remains visible and selectable in the platform list, with its current installation status shown directly below its name.
