// Sink catalog entry: Battlefield presence — Creatures.
//
// One half of a shared-matcher PAIR (`battlefield-presence-cats.ts` is the
// other) — both entries answer the exact same generic "cares about the
// board-state COUNT of a filtered set of permanents you control" question,
// just with a different `types` filter on the producer side and a
// different `subtype` on the consumer side (this entry's own `subtype` is
// OMITTED — the generic, no-subtype-filter case, not "any subtype counts,"
// see `matchesBattlefieldPresenceConsumer`'s own doc comment). The real
// motivating card, in full, is Claws Out (FDN #6):
//
//   costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } }
//   // "Affinity for Cats" — this entry's SIBLING (battlefield-presence-cats)
//   effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control',
//               power: 2, toughness: 2, untilEndOfTurn: true }]
//   // "Creatures you control get +2/+2" — THIS entry
//
// A bare `pumpAll`/`predicate: 'creatures-you-control'` effect with no
// `subtype` filter doesn't literally scale a NUMBER by a board count the way
// "Affinity for Cats" does — it's a flat, unconditional +2/+2 broadcast, not
// a per-creature-counted bonus — but it still genuinely "cares about/
// affects the set of creatures you control" (the user's own explicit
// framing for this pair), the same underlying "battlefield presence of a
// filtered set" concept, just applied uniformly rather than counted.
//
// **Producer** (`query` below): does a candidate itself structurally
// guarantee A creature enters the battlefield under its own control — by
// BEING one (virtually every real Creature card's own baseline
// `entersBattlefield` occurrence) or by CREATING one (any `createToken`
// effect whose own token is a Creature) — same reused baseline/createToken
// occurrences `battlefield-presence-cats.ts` reuses, just filtered on the
// bare card type `'Creature'` instead of the `'Cat'` subtype. Deliberately
// broad BY DESIGN — "Creatures" battlefield presence is meant to be a
// generic, pool-wide count, not a narrow archetype the way "Cats" is.
//
// **Consumer** (`entry.consumerBattlefieldPresence` below, `subtype`
// omitted): does a candidate itself CARE about the board-state count/
// presence of creatures it controls — Claws Out's own real bare `pumpAll`
// shape, checked via `matchesBattlefieldPresenceConsumer` (`match-sink.ts`).
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Creatures', to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } };

// `requireConsumerForSelfOwnership: true` (2026-09-18, real bug fix — see
// `battlefield-presence-cats.ts`'s own header/`SinkCatalogEntry
// .requireConsumerForSelfOwnership`'s doc comment, `entry.ts`) — a card
// that merely IS a Creature (virtually every real Creature card in the
// pool) must NOT self-display "Creatures" on its own page; only a real
// consumer (Claws Out's own bare "Creatures you control get +2/+2") does.
// The reverse direction — any real creature correctly appearing in ANOTHER
// card's own "Creatures" matches — is untouched.
export const entry: SinkCatalogEntry = {
  slug: 'battlefield-presence-creatures',
  query,
  consumerBattlefieldPresence: {},
  requireConsumerForSelfOwnership: true,
};
