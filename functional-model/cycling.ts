// Shared authoring factory for the real "basic Landcycling" family
// (701.19/CR 118.9's own "Typecycling" naming, Forge's own `TypeCycling`
// keyword — see `cloudbound-moogle/definition.ts`'s own comment for the
// full Forge citation, `res/cardsfolder/t/timeless_dragon.txt`'s
// `K:TypeCycling:Plains:2`) — a plain top-level module, same precedent
// `saga.ts`/`tokens.ts` already establish for "shared logic more than one
// real card definition needs," NOT under `functional-model/keywords/`
// (that tree is the SEPARATE keyword-COVERAGE-SCENARIO suite for the
// Keywords page — `registry.ts`'s own header: "NOT scanned by
// verify-synergy.mjs or run-scenarios.mjs ... no interaction with the
// per-card fact-matching pipeline" — a real card's own `CardDefinition`
// never imports anything from there, so an authoring-time factory used
// BY card definitions doesn't belong in that tree; flagged back rather
// than silently placed there despite the coordinator's own suggested
// location).
//
// **Real, whole-pool check before building this** (not assumed): exactly
// 4 real cards already model basic Landcycling via the identical
// structured `abilities` shape this factory now generates byte-for-byte
// (`cloudbound-moogle` — Plainscycling, `ice-flan` — Islandcycling,
// `balamb-t-rexaur` — Forestcycling, `malboro` — Swampcycling), all 4
// sharing the exact same cost string (`'{2}, Discard this card'`) and
// effect shape (`{kind:'move', owner:'you', from:'Library', to:'Hand',
// qty:1, validType:'land', subtype:<X>, shuffleAfter:true}`) — confirmed
// directly against each card's own real printed oracle text (all 4 print
// `{2}` before "Discard this card," never a different mana cost) before
// hardcoding the `, Discard this card` suffix here. A 5th real card,
// `hill-gigas` (Mountaincycling {2}), was still modeled as free
// `staticAbilities` text only — its own former comment claimed "no
// `CardDefinition` field fits it," which was simply STALE (the other 4
// cards already prove the exact same shape fits) — migrated onto this
// factory alongside the other 4, closing that gap for real rather than
// leaving it as a documented-but-wrong limitation.
//
// **Only the mana cost varies** across all 5 real cards — `subtype` is the
// only other axis, and every real basic land type has now been checked at
// least once (Plains/Island/Swamp/Forest structured, Mountain newly
// migrated here) — so this factory's own type parameter is the closed,
// real 5-member `BasicLandSubtype` union, not an open string.
import type { CardDefinition, Effect } from './card';

export type BasicLandSubtype = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';

/** One `CardDefinition.abilities[]` entry — a real 602.1 activation from
 * hand (never a battlefield-permanent ability, never a cast-time
 * alternate cost), cost = `cost` + discarding this card itself
 * (`engine.ts`'s own `costRequiresDiscardSelf`), resolving to a real
 * library search for the named basic land type. `name: 'cycling'` matches
 * every existing basic-landcycling card's own convention (selected by
 * name, `Scenario.ability` — same convention `card.ts`'s own `abilities`
 * doc comment already establishes). */
export function basicLandcycling(subtype: BasicLandSubtype, cost: string): NonNullable<CardDefinition['abilities']>[number] {
  return {
    name: 'cycling',
    cost: `${cost}, Discard this card`,
    effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'land', subtype, shuffleAfter: true } satisfies Effect],
  };
}
