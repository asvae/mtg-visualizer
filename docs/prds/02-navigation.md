# PRD 02 — Navigation: card panel & full page

Status: draft.

## Problem

Navigating from the graph to a card today means a full page transition
away from the graph, losing visual/spatial context. There's no
lightweight "peek" — every card look-up is an all-or-nothing page jump.

## Goals

Notion-style peek-then-expand:

- Clicking a card node opens a right-side slide-over panel with the same
  summary content as the full card page (reusing the existing
  `CardMedia.vue`/`CardRelations.vue` components — `CardMediaRelations.vue`
  no longer exists as one file, it was split into these two, both
  `card`-owned, corrected 2026-09-13), without a full navigation/page
  reload.
- The panel has an expand affordance that navigates to the full
  `/app/card/[set]/[number]` page — the exact same page a direct
  URL/bookmark visit renders, not a divergent "panel-triggered" variant.
- Panel open/closed state rides the existing `?card=` URL-sync
  convention already in `useGraphStore.ts` — no new state mechanism.
- A direct visit to the full card URL always renders the full page,
  never the panel (the panel only exists as a graph-context affordance).

## Non-goals

- Redesigning the full card page's own content/tabs (Facts/Scenarios/
  Replay) — unchanged, `card` specialist's existing domain.
- Any change to prev/next arrow-key navigation on the full page.

## Resolved (2026-09-13)

- Panel closes via Escape/click-outside; the graph underneath (node
  positions, active filters, zoom/pan) is guaranteed untouched by that
  close.
- ~~The review-mode 🧾 icon renders full-page only, not inside the
  panel~~ — moot: the review panel itself was retired entirely
  2026-09-13 (see `scripts/REVIEW_PROCESS.md`), no icon/UI exists to place
  either way anymore.

## Acceptance criteria

- Done when clicking a graph node opens the panel with no full
  navigation/reload, and the graph underneath (node positions, active
  filters, zoom/pan) is unchanged when the panel closes.
- Done when the panel's expand control lands on exactly the same full
  page content a direct URL visit would produce — no separate
  "panel-mode" content fork.
- Done when a bookmarked/shared full card URL always opens the full
  page directly, regardless of how the panel behaves elsewhere.
