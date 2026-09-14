# Card review process

Runbook for a Claude Code session whose job is to drive the card review
loop with the user, one card at a time, until every card in the set is
tagged. Written so a fresh session can follow it without prior context on
this repo's history.

**2026-09-13: the interactive review panel is retired.** There is no more
`review-server.mjs`, `review-relay.mjs`, `ReviewSession.vue`, or 🧾 icon —
that whole queue+relay+panel mechanism has been deleted. The user reviews
cards by just looking at the app's normal card view (the full
`/app/card/[set]/[number]` page, or the graph-side peek panel once that
ships) and confirms/corrects directly in chat — no separate review-specific
UI exists anymore. Everything below reflects that simplified process; if
you find a reference anywhere else in this repo to the old panel/relay
mechanism, it's stale, flag it.

## Why this exists

There's no regex/algorithmic tagger — `data/fin/fin_relations.json` (each
card's theme relations) is authored directly by an agent reading the card
against `scripts/TAGGING_RULES.md`, confirmed or corrected by the user, one
card at a time. That file — not any code — is the actual source of truth
the visualizer reads from (fetched directly, along with
`data/fin/fin_scryfall.json` and `data/global_themes.json`, and assembled
into a graph client-side by `app/lib/buildGraph.ts` — no build step, just
refresh). **Read `scripts/TAGGING_RULES.md` in full before tagging
anything** — it defines every theme, relation type (role), and the weight
conventions this process depends on.

**Every card gets a mechanical prefill first.** `scripts/prefill-main-types.mjs`
bulk-added self-identity Creature/Land (weight 2 produce) and every
creature-subtype produce edge (Bandit, Human, ... weight 2) for every
applicable card — the zero-judgment stuff, so you don't hand-type it. This
means **presence in `fin_relations.json` no longer means "reviewed"** —
most cards have an entry that's mechanical-only. Review status lives
entirely outside `fin_relations.json`, in `tagging/card-enrichment-status.json`,
keyed by card name — a name's `{ "enrichment": "ai", "review": "human" }`
entry there is the real "has a human actually confirmed this" marker (see
`TAGGING_RULES.md`'s "Main types are prefilled" section; the model is
shared across FIN and every historical set — see `GLOBAL_TAGGING_RULES.md`'s
"Output shape" section).

## The loop

In steady state, for each card:

1. **Pick the next un-reviewed card.** In `data/fin/fin_scryfall.json`'s
   own list order (the Scryfall set order — white, blue, black, red,
   green, multicolor, artifact, land — NOT alphabetical; makes reviewing
   color-by-color easier), skipping any name whose
   `tagging/card-enrichment-status.json` entry already has
   `review: "human"` (NOT just "has an entry in `fin_relations.json`" —
   most cards have a mechanical-only prefill entry, see above, and that
   doesn't count), and skipping basic lands / digital-only Alchemy
   rebalances, same as `app/lib/buildGraph.ts` does — they're excluded
   from the visualizer entirely, so tagging one produces an entry nothing
   ever reads (this bit a review session once — `fin_scryfall.json` had a
   stray `digital: true` "A-" card slip through `fetch-set.mjs`'s own
   exclusion query; re-fetching fixed the data, but pick-next-card should
   never trust the raw file alone):
   ```js
   const cards = require('./data/fin/fin_scryfall.json')
     .filter(c => !(c.type_line || '').includes('Basic') && !c.digital);
   const status = require('./tagging/card-enrichment-status.json');
   const next = cards.map(c => c.name).find(n => status[n]?.review !== 'human');
   ```
2. **Inspect it.** `node scripts/review-card.mjs "<name>"` — prints full
   oracle text (both faces for DFCs) plus its current relations
   (`atypical: Not Processed` if genuinely no entry at all, otherwise
   whatever's already there — mechanical prefill and/or a prior real
   review — plus any still-untagged creature-type hint). The user may
   also just have the card open in the app itself (the card page, or the
   graph-side peek panel) — either way, read the oracle text yourself and
   judge it against `TAGGING_RULES.md`, the only source of tagging logic
   there is. The prefilled self-identity/type edges are usually right as
   -is — you're mainly checking whether the weight needs bumping (e.g. a
   card that also makes MORE creatures/lands) and adding whatever else the
   card actually does (consume/atypical/grant/magnifier, other themes
   entirely).
3. **Propose your judgment directly in chat.** State the full set of
   relations you believe are correct (role → theme → weight, per
   `TAGGING_RULES.md`) for the user to confirm or correct. Add a short
   note only if something about the call genuinely isn't obvious from the
   relations list alone (an unusual call, a new theme you think is
   missing) — don't manufacture one otherwise.
4. **Wait for the user's reply:**
   - **Plain confirmation, or a correction closed with a confirming
     phrase** ("good apart from that," "otherwise fine," "the rest is
     right," "that's it," or equivalent — see the confirmation-shorthand
     convention below) — apply any correction, then write the complete
     relation set straight to `data/fin/fin_relations.json` (merge onto
     whatever's already there — a mechanical-prefill entry gets extended/
     replaced, not duplicated), set
     `{ "enrichment": "ai", "review": "human" }` for that name in
     `tagging/card-enrichment-status.json`, run `npm run test` to confirm
     the schema still passes, and move on to the next card (step 1).
   - **Plain correction, no closing signal** — revise your proposal and
     present it again. Nothing gets written to `fin_relations.json` until
     a confirming signal arrives. If the feedback reveals a genuine gap in
     `TAGGING_RULES.md` itself (an ambiguous/wrong theme definition, a
     missing weight convention, a mechanic with no curated theme at all),
     update that doc too — future cards benefit, not just this one; a
     brand-new theme also needs adding to `data/global_themes.json`.

**Confirmation shorthand:** when the user's reply is a correction followed
by a closing phrase like "good apart from that," that phrase means they're
confirming the whole card in that same message, not just flagging one more
thing to fix and re-show — apply the correction and treat it as final
rather than looping back for a second explicit confirmation. Only loop back
for a fresh confirmation when the feedback has no such signal attached.

For a card you're **re-reviewing** (already has a real entry, user wants a
change), the same loop applies — describe the diff from its current entry,
and a confirmation overwrites that entry with the new complete set (not a
merge).

When wrapping up for the day: nothing to stop or restart (no background
processes anymore) — just report how many cards got tagged this run and
what's left (`data/fin/fin_scryfall.json`'s eligible count minus the number
of FIN names with `review: "human"` in `tagging/card-enrichment-status.json`).

## Tags file format (`data/fin/fin_relations.json`)

```jsonc
{
  "name": "<exact Scryfall name, including \"//\" for DFCs>",
  "themes": {
    "produce": { "graveyard": 1 },
    "consume": { "graveyard": 2 }
  }
}
```
Grouped by role, then theme id -> weight (a card can have a theme id under
several roles, and several theme ids under the same role). No `reviewed`
field lives here at all — a human confirming this exact entry via the loop
is instead recorded as `{ "enrichment": "ai", "review": "human" }` for that
name in `tagging/card-enrichment-status.json`, entirely outside `data/` so
review bookkeeping never ships to users alongside what `public/fin` serves.
Omit a status entry (or leave `review: "none"`) for a mechanical-only
prefill nobody's looked at yet; that's what step 1 checks, not mere
presence in `fin_relations.json`. (The enrichment/review model is shared
with the historical-sets pipeline — see `GLOBAL_TAGGING_RULES.md`'s "Output
shape" section — FIN's own loop only ever writes the top tier on both
axes.) No `"card"`/`"edges"`/node-or-edge language at all in this file;
that's the visualizer's own internal graph vocabulary (see `app/types.ts`),
not this file's. One array, one file per set.
`scripts/relations.test.mjs` is a structural sanity check (valid theme
ids/roles/weight range, no duplicate names, every name exists in
`<set>_scryfall.json`, no stray `reviewed` field) — it doesn't (and can't)
check tagging correctness, only shape.

## Scope boundary

This session is an orchestrator like any other (see CLAUDE.md's "Multiple
orchestrators"), just scoped to this one loop instead of general dev work.
Its job is running the review loop and authoring
`data/fin/fin_relations.json`, `data/global_themes.json` (only when adding a
genuinely new curated theme), and, when a review surfaces a genuine gap in
it, `scripts/TAGGING_RULES.md`. Broader work — new UI features, anything
touching files outside those plus `scripts/review-card.mjs` — belongs to
whichever other orchestrator session is scoped to general dev work. If a
piece of user feedback clearly calls for that kind of change, say so rather
than making it here.

Creature subtypes (Human, Goblin, ...) are in scope for tagging, same as any
curated theme — see `TAGGING_RULES.md`'s "Creature types". The theme id/label
is auto-generated (client-side, `app/lib/buildGraph.ts`), AND the baseline
self-identity produce edge (weight 2) is mechanically prefilled too — you
don't need to add that from scratch. What's still your judgment call:
bumping the weight when warranted, and any consume/atypical/grant/magnifier
edge for that type (a genuine payoff like "Goblins you control get
+1/+0"). `node scripts/review-card.mjs` prints a "type_line suggests
(untagged): ..." hint only for a creature type that ISN'T already
prefilled/tagged — increasingly rare now that prefill covers the mechanical
case.
