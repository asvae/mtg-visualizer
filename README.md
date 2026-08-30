# MTG Set Graph

Force-directed graph visualizer for a Magic: the Gathering set's card/theme
synergies. Cards and themes are nodes; edges are the relations between them
(produce/consume/atypical/grant/magnifier), colored and weighted
by role and centrality. Built around Final Fantasy (`FIN`), driven off the raw
data checked into `data/` — the graph itself (cards/themes/edges) is assembled
entirely client-side, at load time, by `src/lib/buildGraph.ts`. There's no
pre-built graph file and no server-side merge step: the app fetches card data
and relation data separately and builds the graph in the browser.

## Quick start

```
npm install
npm run dev
```

Opens the Vite dev server (default `http://localhost:5173`). `data/` is
already checked in — no fetch step needed to just run the app.

## Data

```
data/themes.json                    # global: curated theme id -> label, shared across every set
data/type_themes.json               # global: auto-derived creature-type id -> label (inspection only)
data/fin/fin_scryfall.json          # raw Scryfall card data (fetch:set)
data/fin/fin_tokens_scryfall.json   # token images, for hover (fetch:tokens)
data/fin/fin_relations.json         # hand/agent-authored theme relations (see Tagging model below)
```

```
npm run fetch:set fin        # -> data/fin/fin_scryfall.json
npm run fetch:tokens fin     # -> data/fin/fin_tokens_scryfall.json
npm run derive:types fin     # -> data/type_themes.json (merges in any new creature types)
# data/fin/fin_relations.json is hand/agent-authored, not fetched
```

- **`scripts/fetch-set.mjs`** — pulls every paper card in the set from the
  Scryfall API (excludes basic lands and digital-only Alchemy rebalances).
- **`scripts/fetch-tokens.mjs`** — separately fetches token images (tokens
  aren't returned inline on the card that creates them).
- **`scripts/derive-type-themes.mjs`** — scans a set's raw card data for
  creature subtypes and merges their id -> label into `data/type_themes.json`,
  for human inspection only (the app itself re-derives per-card edges live,
  see `buildGraph.ts` below).
- **`src/lib/buildGraph.ts`** — pure data merge, no tagging logic: combines
  `fin_scryfall.json` (art/mana/type line/etc.), `fin_relations.json` (the
  actual theme judgments), auto-derived creature-type relations (see Tagging
  model), and `data/themes.json` (theme id -> label) into the `GraphFile` the
  app renders. Runs fresh every page load — nothing to regenerate or keep in
  sync after a `fin_relations.json` edit, just refresh.

## Tagging model

There's no tagging code — `data/fin/fin_relations.json` (each card's theme
relations, by name) is authored directly by an agent reading the card against
**`scripts/TAGGING_RULES.md`**, confirmed or corrected by a human, one card at
a time (see Review workflow below). That file was tried as a regex engine
first and the regex was removed: 306 cards, tagged once, reviewed once by a
human doesn't benefit from "instant, deterministic re-runs," and regex-specific
bugs (a self-match silently suppressing an unrelated pattern, two patterns
matching the same substring and double-counting) cost more time than they
saved. Reading the card and judging it directly doesn't have those failure
modes.

`scripts/TAGGING_RULES.md` defines the full model: every relation type
(`produce`, `consume`, `atypical`, `grant`, `magnifier` — a
card can have several for the same theme, e.g. both produce and consume
Graveyard), the weight (1-3) conventions, and the complete list of curated
themes with what counts as each relation type for it. A card with no review
entry at all yet gets a synthetic `not-processed`/`atypical` edge instead of
silently having zero edges — a pending-review marker, not a real theme a
reviewer would ever assign (there's no "confirmed no theme" outcome; a card
with a real but empty review entry — reviewed, genuinely matches nothing —
just has no curated edges at all, which is expected to be rare in practice).

Creature subtypes (Human, Goblin, Vampire, ...) get their theme
auto-generated — `buildGraph.ts` derives every subtype's id/label directly
from card type lines, fresh on every load, so the theme exists before anyone
tags a single card with it (`data/type_themes.json` holds the same list,
checked in for reference). The edge is not automatic, though: whether a card
produces/consumes a given creature-type theme, and at what weight, is a
normal tagging call written to `fin_relations.json` like any curated theme
(see Tagging model, and `TAGGING_RULES.md`'s "Creature types" section). A
subtype whose id collides with an existing curated theme (Dragon, Saga) is
skipped — those stay curated, since they have real produce/consume rules
beyond bare self-identity.

Relation cards show weight as three ascending bars (filled bars indicate
strength) rather than a number, so reviewers can judge it at a glance.

## Review workflow

Cards get tagged and reviewed by hand against their real oracle text, one at
a time, either cold via the CLI:

```
node scripts/review-card.mjs "<card name>"
```

(prints the card's full oracle text — both faces, for DFCs — alongside its
current theme edges, so a tagging call can be made against the actual rules
text instead of guessing from the graph alone) — or interactively, through the
in-app review panel (🧾 icon) driven by an agent session against
`scripts/review-server.mjs`'s control-plane protocol. The 🧾 icon only renders
when `VITE_ENABLE_REVIEW=1` is set (see `.env.example`) — a tagging tool, not
something a deployed/public copy of the app should expose; set it in a local
`.env` and leave it unset wherever the app is actually hosted. **See
`scripts/REVIEW_PROCESS.md` for the full runbook** (protocol reference,
card-selection order, the confirm/feedback loop, tags file format).

Once a card's tagging is confirmed correct it gets written to
`data/fin/fin_relations.json` —

```jsonc
{ "name": "<exact Scryfall name>", "themes": { "produce": { "graveyard": 1 } } }
```

`scripts/relations.test.mjs` is a structural sanity check on that file (valid
theme ids/roles, weight range, no duplicate/unknown card names) — it checks
shape, not tagging correctness (there's no algorithm to regression-test
against anymore).

```
npm run test
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run test` | Runs the tags-file schema check (vitest) |
| `npm run fetch:set <code>` | Fetch a set's raw card data from Scryfall |
| `npm run fetch:tokens <code>` | Fetch that set's token images |
| `npm run derive:types <code>` | Merge that set's creature types into `data/type_themes.json` |

## App architecture

- **`src/lib/buildGraph.ts`** — assembles the `GraphFile` (cards/themes/edges)
  client-side from raw fetched pieces; see Data pipeline above. Pure, no
  Vue/D3 dependency.

- **`src/lib/graphRenderer.ts`** — imperative D3 force simulation. Persistent
  node objects (positions survive filter/search changes — nodes are never
  torn down and recreated). Cards and themes each get their own charge/anchor
  forces; themes classified "weak" (strictly one-sided produce-only or
  consume-only synergy, recomputed live per the currently-active
  color/rarity/type filters) get pulled toward a separate anchor point so
  thin/no-synergy themes don't visually compete with real hubs.
- **`src/store.ts`** — central reactive store (provide/inject). Filters
  (colors/rarities/types/themes) and the clicked-theme selection two-way sync
  to the URL query string (`?colors=...&rarities=...&types=...&themes=...&focus=...`)
  as well as `localStorage` (filters only, not the theme click) per set code —
  a filtered view is shareable via URL. Search and physics slider values persist
  to `localStorage` only, deliberately not the URL. Hover state is ephemeral.
- **`src/lib/filters.ts`** — pure functions over the graph file: faceted
  counts, weak-theme classification, attribute-filter predicates. No Vue/D3
  dependency, so these are unit-testable in isolation from rendering.
- **`src/lib/relations.ts`** — shared relation-description logic
  (`describeRelation`, `groupChipsByVerb`) used by both the hover tooltip and
  wherever else a card's relations need to render as grouped columns.
- **`src/components/CardMediaRelations.vue`** — shared card-image +
  relation-columns display, reused by every place a single card's full
  detail needs to render.

CSS is scoped per-component (`<style scoped>`) except where content is
D3-appended rather than Vue-templated (`GraphCanvas.vue`'s SVG rendering
lives in an explicit unscoped `<style>`, since Vue's scoped-CSS attribute
can't reach nodes D3 appends imperatively). `src/style.css` holds only true
global primitives (CSS custom properties, page reset, `.icon-btn`/
`.legend-dropdown` reused byte-for-byte across 3+ components).
