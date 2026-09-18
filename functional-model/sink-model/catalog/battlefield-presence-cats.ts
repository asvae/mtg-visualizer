// Sink catalog INSTANCE: Battlefield presence — Cats (2026-09-18, split out
// of `battlefield-presence.ts` so the reusable `BattlefieldPresenceSink`
// factory — `families/battlefield-presence.ts` — and this curated, specific
// configuration don't share a module; see that file's own header for the
// full family write-up). Claws Out's own "Affinity for Cats" cost reduction
// is the real motivating consumer; a real Cat creature (Ajani's Pridemate,
// Nine-Lives Familiar) or a Cat-token-making effect (Prideful Parent/
// Arahbo/Cat Collector) is the real producer side.
import { BattlefieldPresenceSink } from './families/battlefield-presence';
import type { SinkInstance } from './entry';

export const battlefieldPresenceCats: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-cats',
  query: { to: 'Battlefield', controller: 'you', types: { has: ['Cat'] } },
  filter: { subtype: 'Cat' },
});
