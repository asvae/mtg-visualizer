# PRD — Graph edge aggregation ("relation hubs")

Status: draft, 2026-09-13. Separate initiative from the numbered
deck-builder PRD sequence (01-05) — a graph-visualization clarity
improvement, not part of that one-by-one build order.

## Problem

A card whose synergy checks against a broad, common condition (e.g. "a
creature is on the battlefield") can end up with an edge to nearly every
matching card currently in scope — for a real corpus example, ~100 FIN
cards share a "battlefield presence" zone-check fact. Drawing every one of
those as an individual edge makes that part of the graph unreadable. Not
every high-fan-out card needs its full connection set visualized at
once — a compact summary (an icon, a label, a count) is more useful than
a hairball, with the detail still available on demand.

**This is substantially already built.** `app/lib/graphRenderer.ts` has an
existing, off-by-default, dev-only prototype ("relation hubs" —
`RelationHubState`, `updateRelationHubs`, `relationHubForce`,
`toggleRelationHub`, a threshold control in `FilterPanel.vue`,
`DEFAULT_RELATION_HUB_THRESHOLD = 20`) that groups a card's edges by
`${sourceId}::${reason.description}` and collapses a group above threshold
into one synthetic node with click-to-expand/collapse — the exact mechanism
this PRD wants, already proven not to need a full rerender or any
incremental-patch capability (hub nodes are deliberately not real D3
simulation nodes). This PRD is about promoting that prototype into a real,
user-facing feature with the specific presentation the user wants, and
addressing its one known rough edge (see Design).

## Goals

- Above a fan-out threshold, collapse a card's same-reason edges into a
  single compact badge on the card node: an icon + a short label + a
  count — e.g. "🐾 Creatures 40" rather than either drawing 40 edges or
  showing the raw abstract fact string.
- **Label preference: concrete over abstract.** Use a direct category name
  ("Creatures") when a clean one exists; fall back to the more abstract
  underlying description ("Battlefield Presence") when it doesn't. Not a
  fully-specified labeling algorithm — good enough, not perfect, is fine
  for this pass.
- **Count reflects what's currently available in Scope** (PRD 01's model)
  — dynamic, recomputed as Scope changes, not a fixed/global number.
- Clicking the badge reveals the individual underlying connections (reuse
  `toggleRelationHub`); collapsing again returns to the compact badge.

## Non-goals

- No new engine/tagging work. Per `ui` specialist research (2026-09-13):
  "Battlefield Presence" and similar broad conditions already surface
  naturally as `reason.description` strings from the existing
  functional-model fact-matching (`findInteractionsForCard`/`factTotal` in
  `functional-model/synergy.ts`) — this PRD is rendering/UX work over
  existing edge data, not new synergy-detection logic.
- Not fixing the separate, already-known engine modeling gap where a real
  single-card "anthem buffs your whole board" case isn't yet properly
  represented (surfaced during prototype tuning — a real anthem card
  produces zero source-fact edges for that clause today). That's an
  `engine`-side question, unrelated to this PRD.
- Not committing to a Deck-scoped count in this pass (see Open questions)
  — floated by the user as a possible extra dimension, not a requirement.

## Design

- Start from the existing prototype (`graphRenderer.ts`'s relation-hub
  machinery + `FilterPanel.vue`'s threshold control) rather than building
  fresh — this is a promotion/refinement pass, not greenfield work.
- **Known rough edge to fix**: the prototype doesn't deduplicate/merge
  near-identical hubs — two cards sharing the exact same broad condition
  against the same target cards can currently spawn two separate hubs
  (grouped by source card) rather than being recognized as the same
  underlying cluster. Exact grouping/merge semantics (e.g. dedupe by
  matched-target-set signature rather than by source card) are TBD at
  implementation time, not decided here.
- Badge visuals (icon choice, label text derivation) need a real look at
  implementation time — TBD whether this draws on an existing icon system
  (`AbilityIcon.vue`, `ManaSymbol.vue`, `MtgIcon.vue`) or needs something
  new for category icons like "Creatures."

## Open questions (flag, don't guess)

- Default threshold: keep the prototype's `20`, or tune once this is a
  real, always-visible feature rather than a dev toggle?
- Should the threshold/on-off state stay a user-facing setting (as the
  prototype's `FilterPanel.vue` checkbox already allows), or become
  fully automatic above threshold with no manual override?
- Should the count optionally also show a Deck-specific figure alongside
  the Scope count (e.g. "40 in scope, 3 in deck") — the user raised this
  as a "maybe," not a firm ask. Worth revisiting once the base feature is
  live and can actually be looked at.
- Exact hub-merge/dedupe grouping key (see Design) — needs a real pass
  against the corpus, not an abstract decision made here.

## Acceptance criteria

- Done when a card whose same-reason edges exceed the (tuned) threshold
  renders as one compact icon+label+count badge instead of individual
  edges — verified against the real battlefield-presence case already
  identified in the corpus, not a synthetic example.
- Done when clicking the badge reveals the individual connections, and
  collapsing returns to the badge — round-trip verified both directions.
- Done when the badge's count updates correctly as Scope changes (add/
  remove a matching card, confirm the number moves).
- Done when the label prefers a concrete category name over the raw
  abstract fact description where a clean one is available, falling back
  to the abstract description otherwise.

## Known related doc staleness (not blocking, flagging so it isn't lost)

`README.md`'s architecture description still says "cards and themes are
both nodes" — stale. The graph has been 100% card-to-card synergy edges
(from functional-model's fact-matching) for a while now; there are no
theme nodes in the live graph at all. Worth a README correction separately,
unrelated to whether/when this PRD gets built.
