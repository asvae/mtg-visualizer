# Deck builder / UI rework — PRD set

**Status: draft, planning stage.** Nothing here is approved for
implementation yet — this is the write-up of a planning conversation
(2026-09-13), not a commitment. Treat each PRD's acceptance criteria as
the bar for calling *that piece* done, not as a green light to start.

## Why this exists

This app is pivoting from a synergy/theme visualizer that explicitly
excluded deck construction and accounts, to one where **real deck
building is the primary purpose**. The user tried keeping deck
construction in a separate tool from this one and found the two-tool
split too clunky to keep. See project memory
`project_deckbuilder_accounts_pivot.md` for the decision record.

**Consequence, not yet done:** once any of this is actually built,
`README.md`'s Scope section ("not a deck builder", "no accounts") and
`CLAUDE.md`'s "Scope, deliberately not" line both need rewriting to drop
those as non-goals. Flagging here so it isn't lost; not touching those
files until a PRD below is actually greenlit for implementation.

## The PRDs

1. [Core concepts: Scope, Filter, Deck](01-core-concepts.md) —
   the vocabulary every other PRD below depends on. Build/land this
   first, even if only partially. Deck is an unconstrained sandbox
   collection (no format/legality/quantity rules) as of 2026-09-13.
2. [Navigation: card panel & full page](02-navigation.md) — Notion-style
   peek panel from the graph, expandable to the full card page.
3. [Search: find & discover](03-search.md) — search does double duty:
   jump to a card already loaded, or pull in one that isn't.
4. [List view](04-list-view.md) — a table-mode companion to the graph,
   for actual deck-construction ergonomics.
5. [Persistence & accounts](05-persistence-accounts.md) — named,
   switchable "projects"; phased local-first, then likely Supabase
   accounts.

## Other PRDs in this folder, not part of the numbered sequence

- [Graph edge aggregation](graph-edge-aggregation.md) — a separate
  graph-visualization initiative (collapsing high-fan-out synergy edges
  into a compact icon+label+count badge, expandable on click). Builds on
  an existing off-by-default prototype in `graphRenderer.ts`. Not gated on
  the 01-05 sequence above, and not built one-by-one alongside it unless
  the user says otherwise.

## Dependency shape

PRD 01 defines terms (Scope/Filter/Deck) that 02-05 all use, but 01, 02,
03, 04 can be built in parallel once the vocabulary is settled — none of
them blocks another. PRD 05 is functionally independent of 02/03/04 (it's
a storage-layer concern) but its "Deck" shape comes from 01, and its
"Project" bundles Scope+Filter+Deck together — worth a naming sanity
check once both exist side by side (see PRD 01's note).

## Explicitly parked, not forgotten

- **Format / legality checking entirely** — dropped, not just
  detail-deferred (2026-09-13 update to PRD 01): Deck is a total sandbox,
  no format concept anywhere. Revisit only as a from-scratch PRD if a
  real need resurfaces.
- **Bulk decklist import** (paste a decklist, resolve every line) — never
  explicitly requested, but a near-certain next ask once Deck is real.
  Not written up as a PRD yet; raise it before or during PRD 03/04
  implementation rather than losing it.
- **Review mode** (the 🧾 tagging panel) — confirmed by the user as an
  afterthought, not a PRD. Just needs to keep working once PRD 02's
  panel/full-page split lands; no redesign.
- **Cross-user project sharing/collaboration** — not discussed at all;
  PRD 05 covers one user's own projects across their own devices only.
