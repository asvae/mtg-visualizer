# MTG Set Graph

Force-directed graph visualizer for a Magic: the Gathering set's card/theme
synergies. Cards and themes are nodes; edges are the relations between them
(produces/consumes/atypical), colored and weighted by role and centrality.
Built around Final Fantasy (`FIN`), driven entirely off `data/fin_graph.json`.

## Quick start

```
npm install
npm run dev
```

Opens the Vite dev server (default `http://localhost:5173`). The graph loads
`data/fin_graph.json`, which is already checked in — no fetch/tag step needed
to just run the app.

## Data pipeline

Three-stage pipeline, each stage a standalone script, output cached to
`data/`:

```
npm run fetch:set fin      # -> data/fin_cards.json   (raw Scryfall card data)
npm run fetch:tokens fin   # -> data/fin_tokens.json   (token images, for hover)
npm run tag fin            # -> data/fin_graph.json    (tagged graph: cards/themes/edges)
```

- **`scripts/fetch-set.mjs`** — pulls every paper card in the set from the
  Scryfall API (excludes basic lands and digital-only Alchemy rebalances).
- **`scripts/fetch-tokens.mjs`** — separately fetches token images (tokens
  aren't returned inline on the card that creates them).
- **`scripts/tag-cards.mjs`** — runs `data/<set>_cards.json` through the
  tagger (`scripts/lib/tagger.mjs`) to produce the graph file the app
  actually reads. This is the only stage that needs re-running after editing
  `THEMES` or `scripts/exceptions.mjs` — the raw/token caches don't change.

Re-running `tag` is safe/idempotent; the frontend only ever reads the graph
JSON, never the raw Scryfall data directly.

## Tagging model

`scripts/lib/tagger.mjs` exports `tagCard(rawCard)` — the single function
that turns one raw Scryfall card object into its theme edges. Pipeline per
card:

1. **Regex theme detection** — each entry in `THEMES` has a broad `mention`
   detector plus `produce`/`consume` regexes (and optionally a `self` match
   keyed off type line/layout rather than text, e.g. "is an Artifact"). A
   card can produce AND consume the same theme — two separate edges, not a
   merged role. No match on either regex still emits an edge with role
   `atypical` (mentioned the theme, but not in a produce/consume way the
   regex recognizes) — that's a deliberate signal for the review pass, not a
   bug.
2. **`scripts/exceptions.mjs` overrides** — per-card overrides for cases the
   regex can't or shouldn't handle generically: force an edge, or suppress
   one (`role: null`) to fix a false positive. Always wins over the regex
   output for that (card, theme) pair.
3. **"No Theme" fallback** — a card matching nothing above gets a synthetic
   `no-theme` edge instead of silently floating with zero edges, so the
   ungrouped bucket is a real, filterable theme like any other.

Edges also carry a **weight** (1-3, how central the card is to that theme —
maxed out for a `self` match) and **modifiers** (`conditional`, `magnifier`,
`granter` — orthogonal to role, e.g. an Equipment's own bonus is a
`granter`).

## Review workflow

The tagger is a v1 heuristic — expect noise. Cards get reviewed by hand
against their real oracle text, one at a time:

```
node scripts/review-card.mjs "<card name>"
```

Prints the card's full oracle text (both faces, for DFCs) alongside its
current theme edges (role/weight/modifiers), so a tagging call can be made
against the actual rules text instead of guessing from the graph alone.

Once a card's tagging is confirmed correct, lock it in as a regression test:
add an entry to `scripts/review-tests/<set>.json` —

```jsonc
{ "card": "<exact Scryfall name>", "edges": [
  { "theme": "graveyard", "role": "produce", "weight": 1, "modifiers": [] }
] }
```

`scripts/review-tests/tagger.test.mjs` is the single file that consumes every
`<set>.json` fixture in that directory: for each entry it looks the card up
in `data/<set>_cards.json`, runs it through `tagCard`, and asserts the edges
match. A later `THEMES`/`exceptions.mjs` change that silently changes an
already-reviewed card's tagging fails a test instead of only showing up as an
unread diff in `data/fin_graph.json`.

```
npm run test
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run test` | Runs the tagger regression tests (vitest) |
| `npm run fetch:set <code>` | Fetch a set's raw card data from Scryfall |
| `npm run fetch:tokens <code>` | Fetch that set's token images |
| `npm run tag <code>` | Tag cards -> `data/<code>_graph.json` |

## App architecture

- **`src/lib/graphRenderer.ts`** — imperative D3 force simulation. Persistent
  node objects (positions survive filter/search changes — nodes are never
  torn down and recreated). Cards and themes each get their own charge/anchor
  forces; themes classified "weak" (strictly one-sided produce-only or
  consume-only synergy, recomputed live per the currently-active
  color/rarity/type filters) get pulled toward a separate anchor point so
  thin/no-synergy themes don't visually compete with real hubs.
- **`src/store.ts`** — central reactive store (provide/inject). Filters,
  search, and physics slider values persist to `localStorage` per set code;
  hover state and theme-selection are ephemeral.
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
