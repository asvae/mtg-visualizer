# PRD 01 — Core concepts: Scope, Filter, Deck

Status: draft. Prerequisite vocabulary for PRDs 02-05. Updated
2026-09-13 after user feedback: **Format is dropped entirely for now**
(see below), and Deck is confirmed as an unconstrained sandbox — closer
to what the user called a "Project" than a rules-checked decklist.
Naming call: keeping the term **Deck** for now since sandbox/cube usage
still reads as "deck" in normal parlance, and it's a cheap rename later
if it turns out to want a different name once PRD 05's actual "Project"
(the saved scope+filter+deck bundle) exists alongside it — flag if that
turns out to feel redundant/confusing once both exist side by side.

## Problem

Today the app has two funnels in code: **scope** (the whole card pool
loaded — pick a set, or a whole `?sf=` Scryfall query, no per-card
granularity) and **filter** (ephemeral show/hide over whatever's in
scope). There's no way to add or remove one specific card from scope,
and no concept of a curated card collection at all.

## Goals

- **Scope** becomes individually editable — add/remove single cards, not
  just "replace the whole pool." Stays perf-bounded as today, but an
  add/remove is a targeted per-card operation, not a bulk re-fetch (see
  Design).
- **Deck** becomes a first-class collection: a name, a list of
  `{card, quantity}` entries. **No format, no legality checking, no
  quantity caps** — a total sandbox, deliberately usable for cubes or
  anything else that isn't a strict 60/100-card constructed deck.

## Non-goals (this PRD)

- **Format entirely** — not a stub, not a UI slot, nothing. Dropped per
  user direction; revisit only if a real need for legality-checking
  resurfaces later, as its own from-scratch PRD.
- Any quantity validation/caps — arbitrary quantities, no rules, ever
  (for this PRD's scope; revisit only if a future PRD wants constrained
  deckbuilding as a distinct mode alongside sandbox mode).
- Sideboards.
- Multiple-projects UI (which project is "current," switching between
  them) — that's PRD 05. Note the naming overlap flagged above: PRD 05's
  "Project" bundles Scope+Filter+**Deck**, so once both exist, confirm
  they don't feel like the same concept wearing two names.

## Design

- **Scope**: unchanged perf-bounded pool. Add/remove is a **targeted
  backend request for that one card**, not a re-fetch of the whole
  scope — reuse the existing per-card endpoint
  (`server/api/card/[set]/[number].ts`, already returns Scryfall +
  relations + shorthand in one request, built for the card page) rather
  than inventing a second fetch path. Driven by PRD 03 (search discover)
  and card-page controls.
- **Frontend-side card cache**: once a card's data is fetched (whether
  for scope, a search discover-preview, or the card page/panel), cache
  it client-side and serve repeat requests from cache instead of
  re-hitting the backend. Card data is stable — no real freshness
  requirement (the user's own edits/tweaks to existing cards are
  infrequent and don't need near-real-time propagation) — so this cache
  can be long-lived (e.g. persisted to IndexedDB/localStorage, no
  aggressive TTL) rather than a short-window cache. Manual invalidation
  (e.g. a dev-facing "clear cache" action) is enough; no need for
  cache-busting infrastructure.
- **Filter**: unchanged.
- **Deck**: `{ name, entries: [{ card, quantity }] }`. That's the whole
  shape — no `format` field.
- **Deck ↔ Scope relationship** (resolves the prior open question): kept
  as **two separate collections, combined only at render time** — modeled
  on the user's MTG Arena analogy (set/scope selection shows what's
  available to browse; your deck stays visible regardless of what's
  currently in scope). Concretely:
  - The rendered card set (graph nodes, list rows) = **Scope ∪ {Deck
    entries with quantity > 0}**.
  - A card that's in Scope but not the Deck: visible, not counted in any
    deck total.
  - A card that's in the Deck but not Scope: still visible (this is the
    "deck is always visible" half of the analogy), just sourced from the
    Deck side of the union instead of Scope.
  - Dropping a Deck entry's quantity to 0 removes it from the Deck side
    of the union — if it's *also* independently in Scope it stays
    visible via Scope, otherwise it disappears from view entirely. This
    is the mechanism, not a separate rule: "remove from view" simply
    falls out of no longer being in either set.

## Acceptance criteria

- Done when adding or removing a single card from Scope makes exactly
  one targeted request for that card (verified by network inspection —
  not a re-fetch of the whole scope/set), and a card already fetched once
  this session is served from the frontend cache on any subsequent
  add/view rather than re-requested.
- Done when a Deck can be created, named, and have cards added/removed
  with arbitrary quantities — no validation, no caps, no format concept
  anywhere in the UI or data model.
- Done when the rendered card set is verifiably the union described
  above: a card added only to the Deck renders even with an empty Scope;
  reducing that card's Deck quantity to 0 removes it from view unless
  it's separately present in Scope.
