# Scope/Deck union model (PRD 01+) — core graph-data architecture

- `store.graph` is a computed union: `baseGraph` (buildGraph() output over
  whatever bulk pool `load()` fetched — `'fin'` or a live Scryfall query)
  plus `scopeAdded`/`scopeRemoved` (Scope edits, namespaced-persisted per
  `SET_CODE` — a statement about *this* bulk pool) plus `deck.entries` with
  qty>0 (Deck, persisted GLOBALLY, independent of whatever Scope is
  loaded). Links for an individually-added card are resolved against the
  full retained `graphLinksPool` (`resolveCardLinks()` in buildGraph.ts),
  since `buildGraph()` itself only ever sees the bulk pool.
- Deck has NO validation/caps (explicit "total sandbox" PRD decision).
  Scope has a 500-card cap (`SCOPE_CAP`, `scopeCardCount`) — re-adding a
  card Scope already effectively has never counts against the cap.
- `app/lib/cardCache.ts`: module-scope `Map`, localStorage-persisted, no
  TTL, manual-clear only. Scoped ONLY to the bare `CardData` field of
  `/api/card/[set]/[number]` — does NOT cache `edges`/`themes`/etc. The
  card detail page's own full-response fetch was deliberately NOT switched
  onto this cache (that's `card` lane's own call).
- `CardPeekPanel.vue` keeps its own SEPARATE small in-memory (not
  localStorage) cache of the fuller `{card,edges,themes}` response, since
  it needs fields `cardCache.ts` doesn't carry.
- Facets (`availableRarities`/`availableTypes`) auto-widen (never narrow)
  when a Scope/Deck-added card introduces a genuinely new value the base
  bulk pool never had — otherwise such a card would render but sit
  permanently hidden behind a filter with no checkbox able to reach it.
  Colors doesn't need this (`COLOR_ORDER` is a fixed, corpus-independent
  list already).
- Deck-scoped "sink supply" node annotations (small text rows under a Deck
  card's node, e.g. "landfall: 4") consume `POST /api/deck-sink-supply`
  (card/engine-owned route) and are entirely independent of the produce/
  consume/... edge system — no `Role`/`GraphReason`/`CardLink` involvement.
  State lives in `useGraphStore.ts` (`deckSinkRows`, refetched debounced
  400ms on any deck change), rendering in `graphRenderer.ts`
  (`renderer.setDeckSinkRows(rows)`, a plain persistent Map keyed by card
  id — same pattern as `keywordHubsById`).
- Deck qty stepper on graph nodes ("− ×N +") is anchored at the EXACT same
  screen position the pre-existing x-N badge always used (chip's right
  edge = `rightEdge - numW`, unchanged formula) with '−'/'+' flanking
  OUTSIDE that box, deliberately allowed to overflow past the art's own
  edges rather than shrinking/repositioning to avoid it. At qty 0, only a
  lone hover-reachable '+' renders (no '−', no chip) — this makes EVERY
  card node capable of adding a first Deck copy directly from the graph,
  not just Deck-existing cards; this was a deliberate scope expansion
  confirmed by the user, not an oversight.
- Real semantic change flagged to `card` lane (status as of 2026-09-13,
  verify still relevant before acting): `getActiveFilterMode()` (consumed
  by the standalone card-detail page) now treats Deck as "active" whenever
  it has ANY entries at all, since the old explicit "Global filter by
  deck" opt-in checkbox is gone — no longer anything to opt into.
- `ListView.vue` (PRD 04's table view) is a second renderer over the exact
  same `store.graph`/`passesAttrFilters` — not a parallel state model.
  There is NO "themes" filter facet anywhere in this codebase despite a
  PRD's own acceptance text listing "colors/rarities/types/themes" —
  `ThemeData`/`EdgeData` are the card-detail page's own per-card synergy
  model, not a graph-wide filter concept. Read that PRD wording as
  aspirational/stale, not a real gap — building a new themes filter facet
  would violate that same PRD's own "no new filter facets" non-goal.
