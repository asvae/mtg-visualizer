// Sink catalog entry: Graveyard fodder.
//
// Verbatim adaptation of a real, already-shipped FIN sink Fact — Fight
// On!'s own `{ zone: 'Graveyard', controller: 'you', types: { has:
// ['Creature'] } }` (`cards/fight-on/synergy.json`), already confirmed to
// agree with production in `match-sink.test.ts` ("sink A"). Re-expressed
// here using the modern `to` spelling (`SYNERGY_DESIGN.md`'s own "New facts
// should use `to` instead" guidance) rather than the legacy `zone` field —
// `effectiveZone`/`isZoneShaped` in `match-sink.ts` treat both identically.
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Graveyard fodder', to: 'Graveyard', controller: 'you', types: { has: ['Creature'] } };

export const entry: SinkCatalogEntry = { slug: 'graveyard-fodder', query };
