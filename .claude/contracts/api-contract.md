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
