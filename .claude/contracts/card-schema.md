# Contract: Engine ↔ Card boundary

Owner of source: **engine** agent. Owner of generated/served output:
**card** agent. If this file drifts from either side's real shape, whoever
noticed says so to the orchestrator — don't silently patch around a stale
contract.

## Per-card functional model (source, `engine` agent owns)

`functional-model/cards/<slug>/`:
- `definition.ts` — exports a `CardDefinition` (see
  `functional-model/card.ts`): `effects: Effect[]`, optional named
  `triggers`, `staticAbilities`, `modal` effect. Data-first — logic lives
  in `Effect` objects the shared `resolveCard()` interpreter dispatches on
  by `kind`, not per-card classes. A `Computed` function or `custom.run` is
  the only escape hatch and is opaque to synergy matching — narrow use only.
- `scenarios.ts` — exports `scenarios: Scenario[]` (see `harness.ts`), or
  `runEngineScenarios(): TraceResult[]` for the real-engine-piloted path
  (see `engine-trace.ts`).

## Generated output (card agent reads/presents, doesn't hand-author)

- `synergy.json` — from `functional-model/synergy.ts`'s
  `findInteractionsForCard`, source/sink facts.
- `trace.json` — `TraceResult[]`, see
  `.claude/contracts/state-event-format.md` for its shape.
- `progress.json` — review/tagging progress state.

## Served shape (card agent owns, `server/api/_cardShaping.ts`)

- `ScryfallCard` / `CardFace` / `ImageUris` interfaces in
  `server/api/_cardShaping.ts` — the live Scryfall-derived shape.
- `minimalCard()` — shrinks a `ScryfallCard` to what the graph/card UI
  actually reads.
- Card identity key across the whole app is **Scryfall name**, not
  `oracle_id` — confirmed 0 collisions across full history. Don't
  re-propose re-keying.

## What each side must not assume

- `card` agent must not assume anything about `Effect` kinds or
  `resolveCard()` internals beyond what's in `synergy.json`/`trace.json` —
  if presenting a fact requires reading `definition.ts` directly, that's a
  sign the generated output is missing something; flag it for `engine`
  rather than reaching into `functional-model/*` yourself.
- `engine` agent must not assume how `synergy.json`/`trace.json` get
  rendered — UI presentation concerns (grouping, labels, collapse/expand)
  belong to `card`.
