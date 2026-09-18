// Sink catalog INSTANCE: Battlefield presence — Creatures (2026-09-18,
// split out of `battlefield-presence.ts` so the reusable
// `BattlefieldPresenceSink` factory — `families/battlefield-presence.ts` —
// and this curated, specific configuration don't share a module; see that
// file's own header for the full family write-up). Claws Out's own bare
// "Creatures you control get +2/+2" (no subtype filter) is the real
// motivating consumer; deliberately broad BY DESIGN — a generic, pool-wide
// count of any real creature or creature-token-making effect, not a narrow
// archetype the way Cats is. The OMITTED `subtype` below (not `subtype:
// 'Creature'`) is the real, deliberate "no filter" case — see `families/
// battlefield-presence.ts`'s own `getName` for how this still resolves to
// the `'Creatures'` display category without a separate authored field.
import { BattlefieldPresenceSink } from './families/battlefield-presence';
import type { SinkInstance } from './entry';

export const battlefieldPresenceCreatures: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-creatures',
  query: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  filter: {},
});
