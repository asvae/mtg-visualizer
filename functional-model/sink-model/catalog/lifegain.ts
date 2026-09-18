// Sink catalog entry: Lifegain.
//
// A shared, reviewed, curated `SinkQuery` — see `catalog/index.ts`'s own
// header for the full "catalog, not per-card" design rationale. This entry
// answers "does a candidate card's own `CardDefinition` cause its
// controller to gain life?" — mirrors the identical real, already-shipped
// FIN sink this project's own `match-sink.test.ts` (`sink D`) already
// verifies agrees with production (`Aerith Gainsborough`'s own real
// `{event:'lifegain', controller:'you'}` sink Fact,
// `cards/aerith-gainsborough/synergy.json`), and is the real want on a real
// FDN card: Ajani's Pridemate's own `onLifeGained` trigger
// (`functional-model/fdn-cards/ajani-s-pridemate/definition.ts`) — see
// `functional-model/fdn-cards/ajani-s-pridemate/sinks.json` for that real
// attachment.
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Lifegain', event: 'lifegain', controller: 'you' };

export const entry: SinkCatalogEntry = { slug: 'lifegain', query };
