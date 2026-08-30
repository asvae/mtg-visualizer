# Card review process

Runbook for a Claude Code session whose job is to drive the interactive card
review loop with the user, one card at a time, until every card in the set is
tagged. Written so a fresh session can follow it without prior context on
this repo's history.

## Why this exists

There's no regex/algorithmic tagger anymore — `data/fin/fin_relations.json`
(each card's theme relations) is authored directly by an agent reading the
card against `scripts/TAGGING_RULES.md`, confirmed or corrected by the user,
one card at a time. That file — not any code — is the actual source of truth
the visualizer reads from (fetched directly, along with
`data/fin/fin_scryfall.json` and `data/themes.json`, and assembled into a
graph client-side by `src/lib/buildGraph.ts` — no build step, just refresh).
**Read `scripts/TAGGING_RULES.md` in full before tagging anything** — it
defines every theme, relation type (role), and the weight conventions this
process depends on.

**2026-08-29 (later the same day): every card now gets a mechanical prefill.**
`scripts/prefill-main-types.mjs` bulk-added self-identity Creature/Land (weight
2 produce) and every creature-subtype produce edge (Bandit, Human, ... weight
2) for every applicable card — the zero-judgment stuff, so you don't hand-type
it. This means **presence in `fin_relations.json` no longer means "reviewed"**
— most cards now have an entry that's mechanical-only. The `reviewed: true`
field on an entry is the real marker now; see step 1 and step 5 below, and
TAGGING_RULES.md's "Main types are prefilled" section.

**2026-08-30: the queue+relay design (current, working).** A first attempt at
a file-based async batch mode (agent writes drafts, a script mechanically
shows them) was tried and reverted 2026-08-29 — that version had the agent's
process itself calling `/show`/`/wait` in a loop with no separation of
concerns, and it desynced from the live panel, leaving it stuck on a stale
`busy` flag. The corrected version, built later and used successfully for the
rest of that session and into 2026-08-30, keeps the same goal (don't make the
user wait on the agent's per-card judgment time) but splits the job cleanly:

- **`scripts/review-drafts.json`** — the agent's own queue of pre-judged
  cards, each `{name, relationsToAdd, relationsToRemove?, note?, confidence?}` (confidence: see below). The agent's
  ONLY job regarding this file: keep it topped up to **5** entries, refilling
  with the next un-reviewed card (raw Scryfall/`fin_scryfall.json` order —
  white, blue, black, red, green, multicolor, artifact, land, NOT alphabetical)
  whenever it drops below 5.
- **`scripts/review-responses.json`** — feedback queue the relay writes to
  when the user's response isn't a plain confirmation. The agent reads it,
  revises the matching draft in `review-drafts.json` (or, if the feedback
  closes with a confirming phrase like "good apart from that" — see step 5
  below — writes straight to `fin_relations.json` instead and removes the
  card from both files), then clears the entry.
- **`scripts/review-relay.mjs`** — a separate long-running Node process (run
  with Bash `run_in_background`, NOT by the agent's own request loop) that is
  PURE PLUMBING: it takes the oldest un-shown/changed draft, `POST /show`s it,
  blocks on `GET /wait`, and on `{type:'allGood'}` writes straight to
  `data/fin/fin_relations.json` (merged onto whatever's already there) with
  `reviewed: true`, removing it from `review-drafts.json`. On
  `{type:'feedback', text}` it appends to `review-responses.json` instead of
  looping itself — it has zero tagging judgment, that's entirely the agent's
  job. Start it once per session: `node scripts/review-relay.mjs`.

This works because the relay is the ONLY thing that ever touches the live
`/show`/`/wait` protocol — the two-file queue never talks to the panel
directly, so there's no way for it to desync the `busy` flag. The agent's
loop, in steady state: poll (or watch) `review-drafts.json`'s length and
`review-responses.json`'s contents; refill the former below 5; act on the
latter as it appears; repeat. **Don't remove `review-relay.mjs` or go back to
the agent calling `/show`/`/wait` directly** — that reintroduces the original
desync bug this design fixes.

## Prerequisites

Three processes must be running:

```
npm run dev                      # Vite dev server, http://localhost:5173
npm run review-server            # control-plane for the review panel, http://localhost:8787
node scripts/review-relay.mjs    # plumbing between review-drafts.json/review-responses.json and the panel
```

Open the app at **http://localhost:5173/app/** (`/` is now a separate static
archetype-landing page, not the visualizer — see index.html/vite.config.js;
the review panel only lives under `/app/`), click the 🧾 icon in the header to
open the review session panel — that's what the user watches while you drive
the loop below. That icon only renders when `VITE_ENABLE_REVIEW=1` is set
(see `.env.example`) — it's already set in the local `.env`, nothing to do
unless it's missing. At the end of a review session, stop `review-relay.mjs`
and `review-server.mjs` (`kill` the node processes) — restart both next time
per the above.

## Protocol (scripts/review-server.mjs)

All JSON, CORS-open (dev server and control-plane run on different ports).

| Endpoint | Direction | Body / response |
|---|---|---|
| `POST /show` | review-relay.mjs → server → browser | `{ card: "<exact name>", relationsToAdd?: [{theme, role, weight?}], relationsToRemove?: [...], note?: "<html>" }` |
| `GET /state` | browser polls | `{ id, card, relationsToAdd, relationsToRemove, note, busy }` |
| `POST /respond` | browser → server | `{ type: 'allGood' }` \| `{ type: 'feedback', text }` \| `{ type: 'stop' }` |
| `GET /wait` | review-relay.mjs (blocks) | long-polls until the next `/respond`, returns its body |

(This table is for reference/debugging the relay itself — as the reviewing
agent you interact with `review-drafts.json`/`review-responses.json` only,
per the loop below, never these endpoints directly.)

The panel shows, in order: the card's art, its **current** tagged relations
(read live from the running app's own client-built graph — always up to date
after a `data/fin/fin_relations.json` edit, just refresh, no need to pass them
yourself), then — only if you're proposing a change — two diff sections: **Relations to add**
(`relationsToAdd`) and **Relations to remove** (`relationsToRemove`), each
`{theme, role, weight?}`. Role is one of `produce`/`consume`/`atypical`/
`grant`/`magnifier` (see `TAGGING_RULES.md`). Finish with your
`note` (only if non-empty — keep it short, HTML is fine: `<h4>`/`<strong>`/
`<p>`, no markdown).

An untagged card's **current** relations will show as `atypical: Not Processed`
— that's the honest state (nothing committed yet, pending review), not a bug.

## The loop (agent side — you never touch `/show`/`/wait` yourself)

With `review-relay.mjs` running, your whole job is keeping two files in the
state described above. Concretely, in a loop (poll both files every few
seconds, or after any edit you make to them):

1. **If `review-drafts.json` has fewer than 5 entries, top it up.** Pick the
   next un-reviewed, un-drafted card: in `data/fin/fin_scryfall.json`'s own
   list order (the Scryfall set order — white, blue, black, red, green,
   multicolor, artifact, land — NOT alphabetical; makes reviewing color-by-
   color easier), skipping any name that's already `reviewed: true` in
   `data/fin/fin_relations.json` (NOT just "has an entry" — most cards have a
   mechanical-only prefill entry now, see the 2026-08-29 note above, and that
   doesn't count) AND any name already sitting in `review-drafts.json`, and
   skipping basic lands / digital-only Alchemy rebalances, same as
   `src/lib/buildGraph.ts` does: they're excluded from the visualizer
   entirely, so tagging one produces an entry nothing ever reads (this bit a
   review session once — `fin_scryfall.json` had a stray `digital: true` "A-"
   card slip through fetch-set.mjs's own exclusion query; re-fetching fixed
   the data, but pick-next-card should never trust the raw file alone):
   ```js
   const cards = require('./data/fin/fin_scryfall.json')
     .filter(c => !(c.type_line || '').includes('Basic') && !c.digital);
   const relations = require('./data/fin/fin_relations.json');
   const reviewed = new Set(relations.filter(t => t.reviewed).map(t => t.name));
   const drafted = new Set(require('./scripts/review-drafts.json').map(d => d.name));
   const next = cards.map(c => c.name).find(n => !reviewed.has(n) && !drafted.has(n));
   ```
   **Inspect it:** `node scripts/review-card.mjs "<name>"` — prints full
   oracle text (both faces for DFCs) plus its current relations (`atypical:
   Not Processed` if genuinely no entry at all, otherwise whatever's already
   there — mechanical prefill and/or a prior real review — plus any
   still-untagged creature-type hint). Read the text yourself and judge it
   against `TAGGING_RULES.md` — that document IS the tagging logic now,
   there's no code path to fall back on. The prefilled self-identity/type
   edges are usually right as-is — you're mainly checking whether the weight
   needs bumping (e.g. a card that also makes MORE creatures/lands) and
   adding whatever else the card actually does (consume/atypical/grant/
   magnifier, other themes entirely). Build the full set of relations you
   believe are correct (role -> theme -> weight, per the rules doc) and
   append `{name, relationsToAdd, relationsToRemove?, note?, confidence}` to
   `review-drafts.json`. Add a short `note` only if something about the
   judgment genuinely isn't obvious from the relations list alone (an unusual
   call, a new theme you think is missing, etc.) — don't manufacture one
   otherwise. Repeat until back at 5.
2. **If `review-responses.json` has entries, act on each and clear it.** The
   relay already showed that card and got a non-`allGood` response — it's
   waiting on you, not looping itself.
   - **Plain correction, no closing signal** → revise the matching entry in
     `review-drafts.json` in place (update `relationsToAdd`/
     `relationsToRemove`/`note`) — the relay detects the content change and
     re-shows it automatically next pass. Don't touch `fin_relations.json`
     yet; nothing's confirmed until the relay sees `allGood`. If the feedback
     reveals a genuine gap in `TAGGING_RULES.md` itself (a theme definition
     that's ambiguous or wrong, a missing weight convention, or a mechanic
     with no curated theme at all), update that doc too — future cards
     benefit, not just this one; adding a brand-new theme also means adding
     it to `data/themes.json`.
   - **Correction plus a closing signal** ("good apart from that," "otherwise
     fine," "the rest is right," "that's it," or equivalent) means the user
     is confirming in the SAME message, not just correcting. Apply the
     correction yourself and write straight to `data/fin/fin_relations.json`
     (merge onto the card's existing entry — same merge logic the relay uses
     on `allGood`) with `reviewed: true`, then remove the card from
     `review-drafts.json`, run `npm run test` to confirm the schema still
     passes, and top the queue back up per step 1. Only fall back to the
     plain-correction path above when there's no "that's everything" signal
     attached (genuinely ambiguous whether more changes are coming).
   - Either way, remove the handled entry from `review-responses.json` when
     done with it.
3. **You'll never see `allGood` or `{type:'stop'}` directly** — the relay
   handles `allGood` itself (writes to `fin_relations.json`, sets
   `reviewed: true`, removes the card from `review-drafts.json`, runs
   `npm run test`). A card silently disappearing from `review-drafts.json`
   with no matching `review-responses.json` entry means exactly this — check
   `fin_relations.json` to confirm, same as any other `allGood`, then top the
   queue back up per step 1. `{type:'stop'}` ends the relay process itself
   (it exits) — if you see it's no longer running, treat that as the user
   ending the session: report how many cards got tagged this run and what's
   left (`data/fin/fin_scryfall.json`'s eligible count minus
   `data/fin/fin_relations.json`'s `reviewed: true` count).

When wrapping up for the day: leave whatever's still in `review-drafts.json`
in place (valid pre-judged proposals, safe to pick up next session — the
relay will just re-show them once restarted), clear
`review-responses.json` if empty already, and stop both `review-relay.mjs`
and `review-server.mjs`.

For a card you're **re-reviewing** (already has a real entry, user wants a
change) the same loop applies — `relationsToAdd`/`relationsToRemove` describe
the diff from its current entry, and `allGood` overwrites that entry with the
new complete set (not a merge).

## Draft confidence (`scripts/review-drafts.json`'s `confidence` field)

**2026-08-30: bulk-drafting mode.** Every draft appended to
`review-drafts.json` gets a `confidence` field — an integer 1-10, the
drafting agent's own self-rated confidence in that specific card's judgment,
shown in the review panel so the human reviewer can prioritize (skim the 9s
and 10s, scrutinize the low numbers first). Rubric:

- **10** — textbook: a clean, unambiguous match to an established rule, no
  edge cases (a vanilla creature with one obvious keyword, say).
- **8-9** — very confident: matches the rules cleanly, at most one minor
  weight judgment call.
- **6-7** — reasonably confident, but a genuine subjective call was involved
  (a borderline weight, an ambiguous "does this count as X" decision that
  could plausibly go either way).
- **4-5** — real uncertainty: multiple plausible interpretations, an
  `atypical` tag used because nothing produce/consume/grant/magnifier fit
  cleanly, or a mechanic partially outside what the curated themes cover.
- **1-3** — low confidence: a very unusual card, a case that plausibly needs
  a brand-new theme not yet curated, or a judgment that required a real
  stretch/guess. Always pair with a `note` explaining why.

This is a per-card, per-drafting-agent self-assessment — it isn't graded
against anything, and a card that's genuinely simple deserves a 10, not
reflexive hedging. When multiple agents draft in parallel (e.g. a bulk-
drafting pass covering many cards at once), each judges its own confidence
independently; there's no cross-agent calibration pass.

## Tags file format (`data/<set>/<set>_relations.json`)

```jsonc
{
  "name": "<exact Scryfall name, including \"//\" for DFCs>",
  "themes": {
    "produce": { "graveyard": 1 },
    "consume": { "graveyard": 2 }
  },
  "reviewed": true
}
```
Grouped by role, then theme id -> weight (a card can have a theme id under
several roles, and several theme ids under the same role). `reviewed: true`
means a human has confirmed this exact entry via the loop — omit it (or leave
it absent/false) for a mechanical-only prefill nobody's looked at yet; that's
what step 1 checks, not mere presence. No `"card"`/`"edges"`/node-or-edge
language at all in this file; that's the visualizer's own internal graph
vocabulary (see `src/types.ts`), not this file's. One array, one file per set.
`scripts/relations.test.mjs` is a structural sanity check (valid theme
ids/roles/weight range, no duplicate names, every name exists in
`<set>_scryfall.json`) — it doesn't (and can't) check tagging correctness,
only shape.

## Scope boundary

This session's job is running the review loop and authoring
`data/fin/fin_relations.json`, `data/themes.json` (only when adding a
genuinely new curated theme), `scripts/review-drafts.json`/
`scripts/review-responses.json` (the queue files described above), and,
when a review surfaces a genuine gap in it, `scripts/TAGGING_RULES.md`.
Broader work — new UI features, restructuring the review panel/protocol
itself (`review-server.mjs`, `ReviewSession.vue`), anything touching files
outside those plus `scripts/review-card.mjs` and `scripts/review-relay.mjs`
— is handled in the other, main dev session. If a piece of user feedback
clearly calls for that kind of change, say so rather than making it here.

Creature subtypes (Human, Goblin, ...) are in scope for tagging, same as any
curated theme — see `TAGGING_RULES.md`'s "Creature types". The theme id/label
is auto-generated (client-side, `src/lib/buildGraph.ts`), AND the baseline
self-identity produce edge (weight 2) is now mechanically prefilled too (see
the 2026-08-29 note above) — you don't need to add that from scratch. What's
still your judgment call: bumping the weight when warranted, and any
consume/atypical/grant/magnifier edge for that type (a genuine payoff like
"Goblins you control get +1/+0"). `node scripts/review-card.mjs` prints a
"type_line suggests (untagged): ..." hint only for a creature type that ISN'T
already prefilled/tagged — increasingly rare now that prefill covers the
mechanical case.
