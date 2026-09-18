// Sink catalog entry: Battlefield presence — Hare Apparent's own same-name
// copies.
//
// A THIRD real-world variant of the shared "Battlefield presence" matcher
// (`battlefield-presence-cats.ts`/`battlefield-presence-creatures.ts` are
// the other two — see either file's own header for the full archetype
// writeup: "cares about the board-state COUNT of a filtered set of
// permanents you control," surfaced as sibling catalog entries sharing one
// matcher function, differentiated only by which FILTER each one names).
// The real motivating card is Hare Apparent (FDN #15): "When this creature
// enters, create a 1/1 Rabbit token for each other creature you control
// named Hare Apparent" — filtered by NAME instead of subtype/creature-type,
// the one dimension `battlefield-presence-cats`/`-creatures` don't cover.
//
// **Why this is its own catalog entry, not folded into `-cats`/
// `-creatures`**: the CONSUMER shape is genuinely different in kind, not
// just a third `subtype` value — `matchesBattlefieldPresenceConsumer`
// checks `costReduction.perControlled`/`pumpAll`/`putCounterAll` for the
// subtype variants, but Hare Apparent has neither; its own board-count
// lives inside a `createToken` effect's `amount` field (a `combinator.ts`
// `Aggregate{op:'count'}` `ValueRef`, not a flat declarative field) — see
// `sink-model/match-sink.ts`'s own `isSameNameCountValueRef`.
//
// **Why the PRODUCER `query` below is a literal `name` constraint, not a
// generic type/subtype filter — a genuine, deliberate divergence from the
// `-cats`/`-creatures` pair's own producer shape, not an oversight**: "same
// name as self" is inherently SELF-referential per card, unlike "Cat"/
// "Creature" (a shared type/subtype that legitimately applies across many
// unrelated cards at once). There is no honest, general "does this
// candidate produce a copy of [whichever card is asking]" query a shared,
// curated `SinkQuery` can express (a `SinkQuery` deliberately carries no
// reference back to the card that owns it — `sink-query.ts`'s own header).
// The one honest producer query for THIS specific card is: "a normal
// permanent literally named 'Hare Apparent' enters the battlefield" — which
// only Hare Apparent's own baseline `entersBattlefield` occurrence (already
// derived by `match-sink.ts`'s pre-existing, unmodified `collectForFace`)
// can ever satisfy, so `matchingCardNames` for this category will always
// read `['Hare Apparent']` alone. This is a real, bespoke, low-reuse
// catalog entry, same as `entry.ts`'s own doc comment explicitly sanctions
// ("a 'bespoke' sink with only one real card wanting it is still just a
// catalog entry with low reuse, per the user's own explicit correction") —
// a hypothetical FUTURE card with the identical "counts its own other
// copies" idiom would need its OWN sibling entry (a different slug, a
// different literal `name`), sharing this same `sameNameAsSelf` consumer
// check and the same shared matcher function, exactly the way
// `battlefield-presence-cats`/`-creatures` already share one matcher across
// two different `subtype` values.
//
// **Self-ownership: `requireConsumerForSelfOwnership: true`, same escape
// hatch as `-cats`/`-creatures`, reasoned through fresh rather than copied
// blind.** Hare Apparent's own baseline `entersBattlefield` occurrence
// trivially satisfies its OWN producer query (`name:{eq:'Hare Apparent'}`)
// — but that's the exact same shape of trivial, non-deliberate self-match
// as "being a Cat trivially satisfies the Cats producer query": EVERY card,
// if given a per-card entry keyed on its own literal name, would trivially
// self-satisfy that query, since a card's own baseline occurrence always
// carries its own name. Bare identity is not an authored ability. What DOES
// make self-display correct here is the CONSUMER side: Hare Apparent's own
// ETB effect genuinely, structurally DEPENDS on counting other copies of
// itself (`createToken.amount`'s own `Aggregate{op:'count'}` over a
// `sameNameAsSelf`-filtered chain) — a real, deliberately-authored "cares
// about the count" consumer, the same class as Claws Out's own real
// Affinity-for-Cats cost reduction, not bare board-state membership. Set
// `true` so self-display is gated on that consumer signal alone, same rule
// `-cats`/`-creatures` already established.
import type { SinkQuery } from '../sink-query';
import type { SinkCatalogEntry } from './entry';

export const query: SinkQuery = { category: 'Same-name copies', to: 'Battlefield', controller: 'you', name: { eq: 'Hare Apparent' } };

export const entry: SinkCatalogEntry = {
  slug: 'battlefield-presence-hare-apparent',
  query,
  consumerBattlefieldPresence: { sameNameAsSelf: true },
  requireConsumerForSelfOwnership: true,
};
