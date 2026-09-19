// Matcher catalog INSTANCE: Battlefield presence — Cats (2026-09-18, split out
// of `battlefield-presence.ts` so the reusable `BattlefieldPresenceMatcher`
// factory — `families/battlefield-presence.ts` — and this curated, specific
// configuration don't share a module; see that file's own header for the
// full family write-up). Claws Out's own "Affinity for Cats" cost reduction
// is the real motivating consumer; a real Cat creature (Ajani's Pridemate,
// Nine-Lives Familiar) or a Cat-token-making effect (Prideful Parent/
// Arahbo/Cat Collector) is the real producer side.
import { BattlefieldPresenceMatcher } from './families/battlefield-presence';
import type { Matcher } from './entry';

// `BattlefieldPresenceMatcher` returns `Matcher[]` (2026-09-19 —
// `MatcherFamily<Config>`'s own return type widened for `CountersMatcher`'s real
// multi-instance case; see `entry.ts`'s own `MatcherFamily` doc comment) — this
// family always returns exactly one real instance per config (see that
// factory's own doc comment), so the `[0]!` below is a real, structurally-
// justified assertion, not a guess.
export const battlefieldPresenceCats: Matcher = BattlefieldPresenceMatcher({
  slug: 'battlefield-presence-cats',
  query: { to: 'Battlefield', controller: 'you', types: { has: ['Cat'] } },
  filter: { subtype: 'Cat' },
})[0]!;
