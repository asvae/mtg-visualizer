# Contract: Server ↔ UI data boundary

Owner of shell/build: **server** agent. Owner of route logic + payload
shape: split by domain — **card** (`server/api/card/*`, `cards*`,
`tokens/*`) and **ui** (`server/api/graph-links.ts`,
`server/api/keywords/index.get.ts`). Consumer of the shapes below: **ui**
agent (graph/filter UI), **card** agent (card page).

## `GET /api/cards`, `/api/cards/by-names` (card agent)

Return `minimalCard(ScryfallCard)` shape from `server/api/_cardShaping.ts`,
joined against `relationsAndThemes()` (tagged relations/themes corpus —
`data/global_relations.json` + `data/fin/fin_relations.json`, FIN wins by
name where both exist per `GLOBAL_TAGGING_RULES.md`).

## `GET /api/graph-links` (ui agent)

```ts
interface GraphLink {
  a: string; // card name
  b: string; // card name
  reasons: GraphReason[]; // app/types.ts — raw share ratios, not a precomputed weight
}
```

Built from `functional-model/synergy.ts`'s `findInteractionsForCard` over
every card's own `cards/<slug>/synergy.json`. Edge strength is
**deliberately not computed server-side** — each reason ships two raw
share ratios (this match's share of its source fact's total output, and of
its sink fact's total demand) and the CLIENT (`graphRenderer.ts`'s
`reasonWeight`) turns those into a number against user-tunable spread
budgets. Don't move that computation server-side — it exists so retuning
the Physics popover sliders needs no re-fetch.

## `POST /api/deck-sink-supply` (card agent, 2026-09-17)

New route backing a graph-node annotation feature (`ui`-owned rendering —
this endpoint is data-only, no relation to the Interactions panel below).
Request body:

```ts
{ deck: [{ set: string, number: string, qty: number }] }
```

— the caller's current Deck (PRD 01's own per-card-quantity sandbox
concept), identified the same set/number way every card route in this app
already does. Doubles as BOTH the targets to compute a report for AND the
pool of potential sources — every deck card's own SINK facts get checked
against every OTHER deck card's own SOURCE facts, per
`functional-model/synergy.ts`'s `computeDeckSinkSupply` (2026-09-17,
engine-owned; see its own doc comment for the exact quantity-weighted
counting rules — one row per distinct sink label via `describeFact`,
count-0 rows included, self-supply withholds exactly one of the target's own
copies).

Response:

```ts
{ results: [{ set: string, number: string, rows: [{ label: string, count: number }] }] }
```

One entry per INPUT deck line, same order, SKIPPING (never erroring on) any
line that doesn't resolve to a real, modeled `PoolCard` (bad set/number, or
a real card with no `functional-model/cards/<slug>` directory / not yet
v2-authored — the same "gray/untouched" bucket
`functional-model/card-status.ts`'s `classifyCardStatus` already names) —
the whole request never 500s over one unmodeled card. Two deck lines
resolving to the SAME card by name (different printings) have their `qty`
summed for the underlying deck-wide computation, so self-supply weighting
reflects the real total copy count, not a per-printing fragment.

Card resolution reuses `server/utils/functionalModelPool.ts`'s
`loadFunctionalModelPool()` (same cached whole-pool `PoolCard[]` loader
`/api/card/:set/:number` and `/api/graph-links` already use) — set/number ->
Scryfall name lookup is a small, deliberate local duplicate of that route's
own `lookupCardBySetNumber` (same precedent `server/api/card/
review-status.ts`'s own `lookupOracleCard` already set), paced the same
110ms/request way against a live Scryfall fallback when `data/cards.db`
isn't present (prod).

## `GET`/`POST /api/card/:set/:number` (card agent)

`functionalModel.annotatedNonFactSpans: AnnotatedNonFactSpan[]` (2026-09-16)
— straight passthrough of `functional-model/cards/<slug>/progress.json`'s
own OPTIONAL `annotatedNonFactSpans` field (see `.claude/contracts/
card-schema.md`'s dated section for the full field meaning/shape:
`{target, line?, start, end, face?, kind, note}`). Always an array on the
served response, `[]` when the card's `progress.json` has none (the common
case — only `ultima-origin-of-oblivion`, fin/2, has a real entry as of this
writing). Type exported as `AnnotatedNonFactSpan` from `server/api/card/
[set]/[number].ts`. Purely presentational — never consulted by any
matching/interaction logic; the Facts tab renders these as extra, non-Fact
rows (no source/sink role) behind its own default-off "non-fact spans"
checkbox, ordered into the SAME text-ordered row list as real Facts.

## `GET /api/keywords` (ui agent)

Serves `functional-model/keywords/*` scenario entries for
`app/pages/app/keywords/index.vue`. Thin passthrough — keep it that way;
keyword *scenario content* belongs to `engine`.

## What `server` must not assume

- Never edit route logic in the above endpoints to fix a build/deploy
  issue — if the failure traces to route content rather than the Nuxt
  shell, hand back to orchestrator to route to `card`/`ui`.

## What `card`/`ui` must not assume

- Don't add new build-affecting config (new deps, Nitro/Netlify config
  changes) inside a route file to route around `server` — flag the need
  for a shell change instead.
