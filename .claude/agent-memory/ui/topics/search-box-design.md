# SearchBox.vue — design decisions worth preserving

- ONE merged, ranked `rows` list (not separate find/discover arrays) —
  ordered purely by name-match quality, NEVER re-sorted by in-scope
  status. This is load-bearing: a toggled-in/out card must not jump
  position, or index-based keyboard focus (`activeIndex`) breaks. Per-row
  `inScope` (live, off `store.graph`) and `discoverable` (was this id ever
  returned by the live fetch for the current query, independent of scope
  membership) are computed live on every access, not baked into a
  snapshot at fetch time.
- Keyboard "arm then confirm" gesture for add/remove: ArrowRight arms the
  active row's own button (visual ring, zero side effect) unconditionally
  whenever that row has a button — deliberately NOT gated on caret
  position (an earlier caret-at-end-only guard silently broke after a
  mouse-click-then-keyboard sequence re-focused the input without landing
  the caret at the end). Enter-while-armed toggles; a second Enter while
  still armed flips back; ArrowLeft un-arms. Plain Enter (or a row-body
  click) always OPENS regardless of row kind — add/remove is a wholly
  separate, only-ever-explicit action.
- Discover fetch: `POST /api/cards` with `q: name:"<term>"` (quote-scoped,
  not a bare Scryfall search) — deliberately name-only so oracle-text
  matches don't flood results. `discoverResults` itself is never filtered
  by current scope membership at fetch time (a stale snapshot filtered
  once would show wrong state after a later add) — `inScope`/`discoverable`
  both derive live per-render instead.
- Scope's 500-card cap (`SCOPE_CAP` in `useGraphStore.ts`) is checked before
  any mutation; re-adding a card Scope already effectively has never counts
  against it.
- **Known, unresolved cross-lane data-parity gap** (flagged to `card`
  lane, status as of 2026-09-16 — verify still true before repeating):
  "Newest first" sort only works for cards from the local FIN bulk pool.
  `released_at` is stripped before the client ever sees it on every OTHER
  path — `_cardShaping.ts`'s `minimalCard()`, `server/api/cards.ts`,
  `server/api/card/[set]/[number].ts`, `server/api/cards/by-names.ts` all
  omit it. This means a live-discovered broad query (the exact case the
  feature was meant to help with — "the one card buried in results") can't
  actually be sorted by release date at all yet. Needs `card` lane to
  thread `released_at` through those routes' response shapes.
- Route-aware default action: see `card-peek-panel-design.md` (same
  `openRow` logic SearchBox and the status grid share).
