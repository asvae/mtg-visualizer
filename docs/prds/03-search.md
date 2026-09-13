# PRD 03 — Search: find & discover

Status: draft.

## Problem

Search today only finds/highlights a card already loaded into the
current graph (scope). There's no way to search for a card that isn't
loaded and pull it in — scope can only be replaced wholesale (pick a
different set or a whole new `?sf=` query), never edited one card at a
time.

## Goals

One search box, two distinguishable behaviors in the results dropdown:

- **Find** — jump to/focus a card already in Scope. Existing behavior,
  unchanged.
- **Discover** — a live Scryfall-backed lookup (same resolution path
  `server/api/cards.ts` already uses for `?sf=` queries) for a card not
  currently in Scope. Always checks live Scryfall, not just the
  already-tagged corpus (confirmed choice — an added card may have
  little/no synergy data until tagged, that's expected and fine). A
  per-row action (e.g. Right arrow → Enter, or an inline `+` button)
  adds exactly that one card to Scope without navigating away; default
  Enter still opens the card (panel/full page, per PRD 02).

Dropdown rows must visually distinguish "already in scope" (find) from
"not yet in scope" (discover, with an add action available).

## Non-goals

- Bulk import (pasting a whole decklist and resolving every line at
  once) — flagged in the PRD-set README as a near-certain next ask, not
  covered here.
- Any change to how Scope's overall perf cap is enforced — this PRD adds
  a way to approach that cap one card at a time, not a way to raise it.

## Resolved (2026-09-13)

- Scope's perf cap (500 today) applies to discover additions too. No
  remaining-capacity indicator for v1 — a hard stop with an error message
  when an attempted add would exceed 500 is sufficient. Revisit the UI
  (a visible running count, etc.) later if it turns out to matter.

## Acceptance criteria

- Done when typing a card name not in current Scope surfaces it in the
  dropdown via a live lookup, clearly marked as not-yet-in-scope
  (distinct styling/badge from an in-scope match).
- Done when the discover action adds exactly the one selected card to
  Scope — not the set it belongs to, not a whole new query — without
  disturbing existing node positions or active filters.
- Done when Enter on a find-result and the discover action on a
  discover-result produce clearly different, intentional outcomes
  (navigate vs. add), with no path that accidentally triggers the wrong
  one.
- Done when attempting a discover-add that would push Scope past 500
  cards is refused with a clear error message, no partial/silent add.
