// Matcher catalog INSTANCE: Battlefield presence — Creatures (2026-09-18,
// split out of `battlefield-presence.ts` so the reusable
// `BattlefieldPresenceMatcher` factory — `families/battlefield-presence.ts` —
// and this curated, specific configuration don't share a module; see that
// file's own header for the full family write-up). Claws Out's own bare
// "Creatures you control get +2/+2" (no subtype filter) is the real
// motivating consumer; deliberately broad BY DESIGN — a generic, pool-wide
// count of any real creature or creature-token-making effect, not a narrow
// archetype the way Cats is. The OMITTED `subtype` below (not `subtype:
// 'Creature'`) is the real, deliberate "no filter" case — see `families/
// battlefield-presence.ts`'s own `getName` for how this still resolves to
// the `'Creatures'` display category without a separate authored field.
import { BattlefieldPresenceMatcher } from './families/battlefield-presence';
import type { Matcher } from './entry';

// `BattlefieldPresenceMatcher` returns `Matcher[]` (2026-09-19 —
// `MatcherFamily<Config>`'s own return type widened for `CountersMatcher`'s real
// multi-instance case; see `entry.ts`'s own `MatcherFamily` doc comment) — this
// family always returns exactly one real instance per config (see that
// factory's own doc comment), so the `[0]!` below is a real, structurally-
// justified assertion, not a guess.
export const battlefieldPresenceCreatures: Matcher = BattlefieldPresenceMatcher({
  slug: 'battlefield-presence-creatures',
  query: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  filter: {},
})[0]!;
