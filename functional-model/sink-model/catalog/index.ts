// The sink catalog — the ONE shared, reviewed list of curated `SinkQuery`
// entries (see `entry.ts`'s own doc comment for the "catalog, not per-card"
// rationale). Growing this list is a deliberate, explicit, one-line act —
// same discipline `sink-derivation-status.ts`'s own hand-seeded
// `SINK_DERIVATION_MECHANISMS` array already establishes ("organic growth,
// no speculative pre-seeding") — but discovery here is a real, statically
// imported registry rather than a metadata-only array: every entry in
// `SINK_CATALOG` genuinely has a real, existing `catalog/<slug>.ts` module
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
import { entry as graveyardFodder } from './graveyard-fodder';
import { entry as lifegain } from './lifegain';
import { entry as etb } from './etb';
import { entry as battlefieldPresenceCats } from './battlefield-presence-cats';
import { entry as battlefieldPresenceCreatures } from './battlefield-presence-creatures';
import { entry as battlefieldPresenceHareApparent } from './battlefield-presence-hare-apparent';
import { entry as countersPlus1Plus1 } from './counters-plus1plus1';

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
