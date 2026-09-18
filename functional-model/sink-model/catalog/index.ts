// The sink catalog — the ONE shared, reviewed list of curated `SinkQuery`
// entries (see `entry.ts`'s own doc comment for the "catalog, not per-card"
// rationale). Growing this list is a deliberate, explicit, one-line act —
// same discipline `sink-derivation-status.ts`'s own hand-seeded
// `SINK_DERIVATION_MECHANISMS` array already establishes ("organic growth,
// no speculative pre-seeding") — but discovery here is a real, statically
// imported registry rather than a metadata-only array: every entry in
// `SINK_CATALOG` genuinely has a real, existing catalog module backing it
// (there is no "gray, not built yet" state for a catalog entry the way
// there is for a sink-derivation-predicate mechanism — a not-yet-authored
// catalog entry simply isn't in this array at all yet, same "absence is its
// own signal, not a computed value" treatment `pipeline-status.ts`'s own
// "(no folder at all)" case already establishes). `functional-model/
// sink-catalog-status.ts` computes each entry's own gray/purple/blue/
// yellow/green/re-review REVIEW status on top of this array (module always
// exists once listed here — the axis instead tracks whether this entry's
// own mocked-fixture structural gate, `<slug>.test.ts` + `<slug>.corpus
// .json`, has been built and is fully passing).
//
// **2026-09-18, `BattlefieldPresenceSink`/`CountersSink` factory refactor**
// — a real multi-instance entry no longer has its own standalone
// `catalog/<slug>.ts` module; `battlefield-presence-cats`/`-creatures`/
// `-hare-apparent` are 3 real, independently-configured instances built by
// ONE shared `BattlefieldPresenceSink` factory living in
// `catalog/battlefield-presence.ts` (`counters-plus1plus1` likewise from
// `CountersSink`, `catalog/counters.ts`) — see either file's own header for
// the full factory writeup, and `entry.ts`'s `SinkCatalogEntry.family`/
// `SinkInstance`/`SinkFamily` doc comments for the real vocabulary
// (`SINK_CATALOG` itself is still a flat array of individual sink
// INSTANCES, review status is what's now grouped by family —
// `sink-catalog-status.ts`).
import { entry as graveyardFodder } from './graveyard-fodder';
import { entry as lifegain } from './lifegain';
import { entry as etb } from './etb';
import { battlefieldPresenceCats, battlefieldPresenceCreatures, battlefieldPresenceHareApparent } from './battlefield-presence';
import { countersPlus1Plus1 } from './counters';

export type { SinkCatalogEntry } from './entry';

export const SINK_CATALOG = [
  lifegain,
  graveyardFodder,
  etb,
  battlefieldPresenceCats,
  battlefieldPresenceCreatures,
  battlefieldPresenceHareApparent,
  countersPlus1Plus1,
];
