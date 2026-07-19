## Context

The API settings sidebar renders provider cards at 52 px high with a 10 px radius, while CLI shortcuts currently render at 40 px high with a 12 px radius. The change is limited to the existing sidebar CSS.

## Goals / Non-Goals

**Goals:**

- Visually align CLI shortcut controls with the provider cards above them.
- Preserve their compact icon-and-label layout and existing interaction behavior.

**Non-Goals:**

- Changing the provider cards, action labels, icon sizes, provider data, or mobile layout.
- Adding new CLI integrations or configuration behavior.

## Decisions

- Set the CLI shortcut buttons to the provider cards' 52 px outer height and 10 px corner radius. This makes the requested visual relationship explicit while retaining their left-aligned contents. Matching the nearby add/recommend actions was rejected because they are secondary actions with a different 42 px height.

## Risks / Trade-offs

- [The sidebar becomes taller] → The sidebar already scrolls independently; matching the provider-card dimensions makes CLI settings equally scannable.
