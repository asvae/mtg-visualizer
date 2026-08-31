# MTG Set Graph

Force-directed graph visualizer for a Magic: the Gathering set's card/theme
synergies. Cards and themes are nodes; edges are the relations between them
(produce/consume/atypical/grant/magnifier), colored and weighted
by role and centrality. Built around Final Fantasy (`FIN`) by default, driven
off the raw data checked into `data/` — the graph itself (cards/themes/edges)
is assembled entirely client-side, at load time, by `app/lib/buildGraph.ts`.
There's no pre-built graph file and no server-side merge step for that
default set: the app fetches card data and relation data separately and
builds the graph in the browser. A card can also carry an arbitrary
[Scryfall search](https://scryfall.com/docs/syntax) instead (`?sf=<query>` on
`/app`, or the 🔍 header button) — `server/api/cards.ts` (a Nitro/Netlify
Function) resolves that query live against the Scryfall API and the
already-tagged `data/global_relations.json` corpus, capped at 500 cards.

Built with [Nuxt 4](https://nuxt.com) + [Nuxt UI](https://ui.nuxt.com)
(Tailwind CSS + Reka UI under the hood) — SPA-only for the graph app itself
(`routeRules['/app'] = { ssr: false }` in `nuxt.config.ts`; its store reads
`window.location`/`localStorage` throughout and has nothing to gain from
server rendering), while the landing page (`/`) is prerendered normally so it
stays crawlable/shareable.

## Versioning

Manual [SemVer](https://semver.org/), bumped by hand in `package.json` +
[`CHANGELOG.md`](CHANGELOG.md) — no automated release tooling.

## Quick start

```
npm install
npm run dev
```

Opens the Nuxt dev server at `http://localhost:3000`. `data/` is already
checked in — no fetch step needed to just run the app. The static files the
browser actually fetches (`global_themes.json`, `fin/*`) are served via
symlinks in `public/` pointing back into `data/` (see Data below) — there's
only ever one real copy on disk.

## Data

```
data/global_themes.json             # global: curated theme id -> label, shared across every set
data/global_relations.json          # global: every tagged card (any set) by name — the scryfall-query filter's corpus
data/type_themes.json               # global: auto-derived creature-type id -> label (inspection only)
data/fin/fin_scryfall.json          # raw Scryfall card data (fetch:set)
data/fin/fin_tokens_scryfall.json   # token images, for hover (fetch:tokens)
data/fin/fin_relations.json         # hand/agent-authored theme relations (see Tagging model below)
```

`public/global_themes.json` and `public/fin` are symlinks into the `data/`
files above — Nuxt serves whatever's in `public/` at the site root, but the
tagging pipeline's actual source of truth stays in `data/`; the symlinks just
expose the subset the browser needs without a second copy or a build-time
sync step (and deliberately don't expose `data/global_relations.json` or the
raw Scryfall bulk-data dumps client-side — those are read server-side only,
by `server/api/cards.ts` and the tagging scripts, respectively).

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
- **`app/lib/buildGraph.ts`** — pure data merge, no tagging logic: combines
  `fin_scryfall.json` (art/mana/type line/etc.), `fin_relations.json` (the
  actual theme judgments), auto-derived creature-type relations (see Tagging
  model), and `data/global_themes.json` (theme id -> label) into the
  `GraphFile` the app renders — same shape either way, whether the raw pieces
  came from the static per-set files or from `server/api/cards.ts`'s query
  response. Runs fresh every page load — nothing to regenerate or keep in
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
when `NUXT_PUBLIC_ENABLE_REVIEW=true` is set (see `.env.example`) — a tagging
tool, not something a deployed/public copy of the app should expose; set it
in a local `.env` and leave it unset wherever the app is actually hosted. **See
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
| `npm run dev` | Nuxt dev server (`http://localhost:3000`) |
| `npm run build` | Production build (Nitro, `netlify` preset) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `nuxt typecheck` |
| `npm run test` | Runs the tags-file schema check (vitest) |
| `npm run fetch:set <code>` | Fetch a set's raw card data from Scryfall |
| `npm run fetch:tokens <code>` | Fetch that set's token images |
| `npm run derive:types <code>` | Merge that set's creature types into `data/type_themes.json` |

## App architecture

- **`app/lib/buildGraph.ts`** — assembles the `GraphFile` (cards/themes/edges)
  client-side from raw fetched pieces; see Data above. Pure, no Vue/D3
  dependency.
- **`app/lib/graphRenderer.ts`** — imperative D3 force simulation. Persistent
  node objects (positions survive filter/search changes — nodes are never
  torn down and recreated). Cards and themes each get their own charge/anchor
  forces; themes classified "weak" (strictly one-sided produce-only or
  consume-only synergy, recomputed live per the currently-active
  color/rarity/type filters) get pulled toward a separate anchor point so
  thin/no-synergy themes don't visually compete with real hubs.
- **`app/composables/useGraphStore.ts`** — central reactive store
  (provide/inject via `StoreKey`, provided once from `app/pages/app.vue`).
  Filters (colors/rarities/types/themes), the clicked-theme selection, and
  the clicked-card selection two-way sync to the URL query string
  (`?colors=...&rarities=...&types=...&themes=...&focus=...&card=...`,
  `?sf=...` for the scryfall-query mode) as well as `localStorage` (filters
  only, not the click selections) per set code — a filtered/selected view is
  shareable via URL. A category (colors/rarities/types/themes) is omitted
  from the URL entirely once it matches its own default, so e.g. "Reset
  filters" produces an empty query string instead of one spelling out every
  id. Clicking a card highlights its connected themes (same mechanism as
  clicking a theme, mirrored); Ctrl/Cmd-click opens it on Scryfall instead of
  selecting it. Search and physics slider values persist to `localStorage`
  only, deliberately not the URL. Hover state is ephemeral.
- **`app/lib/filters.ts`** — pure functions over the graph file: faceted
  counts, weak-theme classification, attribute-filter predicates. No Vue/D3
  dependency, so these are unit-testable in isolation from rendering.
- **`app/lib/relations.ts`** — shared relation-description logic
  (`describeRelation`, `groupChipsByVerb`) used by both the hover tooltip and
  wherever else a card's relations need to render as grouped columns.
- **`app/components/CardMediaRelations.vue`** — shared card-image +
  relation-columns display, reused by every place a single card's full
  detail needs to render.
- **`server/api/cards.ts`** — the scryfall-query filter's backend (see Data
  above); a plain Nitro server route, deployed as a Netlify Function
  automatically by the `netlify` Nitro preset (`nuxt.config.ts`).

Styling is [Nuxt UI](https://ui.nuxt.com) components (Reka UI primitives +
Tailwind variants) plus Tailwind utility classes in each component's own
template — `app/assets/css/main.css` holds only the shared `@theme` color
tokens (`--color-produce`, `--color-panel`, etc.) and the Tailwind/Nuxt UI
imports. Two deliberate exceptions stay as plain CSS instead of Tailwind
classes, both referencing those same `--color-*` custom properties directly:
`GraphCanvas.vue`'s unscoped `<style>` (its SVG content is D3-appended, not
Vue-templated, so there's nowhere to put a `class="..."` attribute) and a
small `:deep()` block in `ReviewSession.vue` styling agent-authored `v-html`
content the same way.
