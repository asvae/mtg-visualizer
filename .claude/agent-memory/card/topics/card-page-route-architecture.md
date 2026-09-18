# Card page route architecture: one content component, several page hosts

`app/components/CardDetailTabs.vue` is the real content hub — CardMedia,
the review-status table, annotated/plain oracle text, the Facts/Scenarios/
Facts-Json/Card-Json/Card-Definition(/Sinks for FDN) tab strip, the
cross-card Interactions panel, both debug modals. It reads two props
(`data: CardResponse`, `set`/`number: string`) and owns essentially all the
Facts-tab machinery (ordering, hover-highlight, copy-context, provenance
toggles, review-status optimistic flip, etc). Three real hosts currently
mount it:

1. **`app/pages/app/card/[set]/[number].vue`** — the standalone,
   user-facing card page. Owns its own `useFetch`, deck/query-filter-aware
   Previous/Next (`useSetOrder`/`neighborsInSetOrder` + an active
   global-filter overlay), the deck-qty badge, loading/error states.
2. **`app/components/CardPeekPanel.vue`** — the graph page's floating
   overlay panel (opened via `store.panelCardKey`).
3. **`app/pages/app/engine/cards/[set]/[[number]].vue`** — the dev/engine
   console's Cards tab (sidebar list + inline detail pane, its own
   Previous/Next via `EngineConsoleShell`, no deck-qty concept).

**Standalone `/app/card/...` and `/app/engine/cards/...` are deliberately
two separate ROUTES, not one** — a 2026-09-18 task consolidated them into
one (deleting the standalone page and pointing every link at the engine
console route), and was explicitly reverted the same day per direct user
correction: "for now we use the same component, but that might diverge at
some point in the future." Don't re-attempt merging them without checking
this first — `/app/engine/cards/[set]/[[number]].vue`'s own header comment
is known-stale on this point (still claims to be "the one real card-detail
page") and was deliberately left that way, since the file itself wasn't
being touched when the revert happened.

`CardDetailTabs.vue` branches on `props.set === 'fdn'` (`isFdn`) for
FDN-specific content — see `topics/fdn-vs-fin-card-model.md`.

`CardRelations.vue` is unused app-wide since `CardPeekPanel.vue` stopped
rendering it (superseded by `CardDetailTabs.vue`) but was deliberately left
in place, not deleted, as of the last check — a small future cleanup, not
a bug.
