// Sink catalog entry: Battlefield presence — Cats.
//
// One half of a shared-matcher PAIR (`battlefield-presence-creatures.ts` is
// the other) — see that sibling file's own header for the full "Battlefield
// presence" archetype writeup and the real motivating card, Claws Out (FDN
// #6): "Affinity for Cats" (`costReduction: {perControlled: {amountPerMatch:
// 1, subtype: 'Cat'}}`) is THIS entry's own consumer half; "Creatures you
// control get +2/+2" (a bare `pumpAll`, no subtype) is the sibling's.
//
// **Producer** (`query` below): does a candidate itself structurally
// guarantee a Cat permanent enters the battlefield under its own
// control — either BY BEING one (a real Cat creature's own baseline
// `entersBattlefield` occurrence, `match-sink.ts`'s `collectForFace`/
// `isNormalPermanent`) or by CREATING one (a `createToken` effect whose own
// `TokenInfo.types` includes `'Cat'`) — reuses the EXISTING baseline/
// createToken occurrences directly, no new occurrence needed: both already
// carry a `to: 'Battlefield'`/`controller: 'you'` shape and resolve a real
// concrete subject (`self`, or the created token's own `resolvedAttrs`)
// whose `types` (`synergy.ts`'s `typeWordsFromTypeLine`/`TokenInfo.types`)
// already includes real creature SUBTYPES, not just card types — Ajani's
// Pridemate (`Creature — Cat Soldier`) and Arahbo/Prideful Parent/Cat
// Collector's own Cat-token creation (real FDN cards) all satisfy this with
// zero new matching code.
//
// **Consumer** (`entry.consumerBattlefieldPresence` below): does a candidate
// itself CARE about the board-state count of Cats it controls — Claws Out's
// own real "Affinity for Cats" shape, checked via
// `matchesBattlefieldPresenceConsumer` (`match-sink.ts`).
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Cats', to: 'Battlefield', controller: 'you', types: { has: ['Cat'] } };

// `requireConsumerForSelfOwnership: true` (2026-09-18, real bug fix — see
// `SinkCatalogEntry.requireConsumerForSelfOwnership`'s own doc comment,
// `entry.ts`) — a card that merely IS a Cat (Helpful Hunter, Ajani's
// Pridemate, ...) must NOT self-display "Cats" on its own page; only a real
// consumer (Claws Out's own "Affinity for Cats") does. The reverse
// direction — a real Cat correctly appearing in ANOTHER card's own "Cats"
// matches — is untouched.
export const entry: SinkCatalogEntry = {
  slug: 'battlefield-presence-cats',
  query,
  consumerBattlefieldPresence: { subtype: 'Cat' },
  requireConsumerForSelfOwnership: true,
};
