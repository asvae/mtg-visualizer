// Sink catalog entry: Lifegain.
//
// A shared, reviewed, curated `SinkQuery` — see `catalog/index.ts`'s own
// header for the full "catalog, not per-card" design rationale. `query`
// answers the PRODUCER-side question, "does a candidate card's own
// `CardDefinition` cause its controller to gain life?" — mirrors the
// identical real, already-shipped FIN sink this project's own
// `match-sink.test.ts` (`sink D`) already verifies agrees with production
// (`Aerith Gainsborough`'s own real `{event:'lifegain', controller:'you'}`
// sink Fact, `cards/aerith-gainsborough/synergy.json`).
//
// `consumerTriggerNames` (2026-09-18, added after the earlier per-card
// `sinks.json` attachment concept was tried-then-reverted, see
// `pipeline-status.ts`'s own header note — this entry USED to point at a
// `functional-model/fdn-cards/ajani-s-pridemate/sinks.json` file that no
// longer exists) answers the CONSUMER-side question instead: does a
// candidate REACT to some other source of lifegain? Ajani's Pridemate's own
// `onLifeGained` trigger (`functional-model/fdn-cards/ajani-s-pridemate/
// definition.ts`) is the real, motivating case — it has no `gainLife`
// effect of its own (so `query` alone declines it), but its trigger's own
// `name` is a real, deliberately-authored structural handle for exactly
// this precondition (see `entry.ts`'s own doc comment on
// `consumerTriggerNames` for why this is a safe, lower-stakes use of
// `Trigger.name` — a pure field comparison, never oracle/printed text).
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Lifegain', event: 'lifegain', controller: 'you' };

export const entry: SinkCatalogEntry = { slug: 'lifegain', query, consumerTriggerNames: ['onLifeGained'] };
