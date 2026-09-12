import type { CardDefinition, Effect } from '../../card';

// Real script (fin/60): Flying; "You may look at the top card of your
// library any time."; "As long as The Lunar Whale attacked this turn, you
// may play the top card of your library."; Crew 1. Migrated to the unified
// Fact model 2026-09-12.
//
// Flying — bare printed keyword, no fact (2026-09-12 standing rule,
// SYNERGY_DESIGN.md: purely passive, no observable occurrence — same
// treatment Cargo Ship's own Flying/Vigilance already get).
//
// "You may look at the top card of your library any time." — a pure
// information-only static permission: nothing changes, nothing moves, no
// occurrence a sink could ever consume (checked: no fact in the pool wants
// "controller has looked at their own library top," and this genuinely
// isn't a zone transition/event, the two only shapes a SOURCE fact is
// allowed to describe). No Fact authored for it — same "nothing real to
// anchor a state change to" reasoning that got Summon: Bahamut's own
// `self-battlefield` deleted outright, not a card-specific carve-out.
//
// "As long as The Lunar Whale attacked this turn, you may play the top
// card of your library." — a real, genuine attack-conditional
// card-advantage engine. Was a real, DOUBLE engine gap (ENGINE_GAPS.md gap
// #16) — both halves now CLOSED (2026-09-12):
//   - `RealCard.attackedThisTurn` (state.ts) — a real, persistent
//     per-permanent flag, set by `engine.ts`'s `declareAttackers` for every
//     real declared attacker, cleared game-wide at the next real Cleanup
//     (`turn.ts`, `state.clearAttackedThisTurn`). Real Forge citation:
//     `CardDamageHistory.attackedThisTurn`/`hasAttackedThisTurn`
//     (forge-game/.../card/CardDamageHistory.java).
//   - `card.ts`'s new `kind:'playFromLibraryTop'` Effect — real CR 601/305
//     dispatch (land-drop vs. cast, whichever the revealed top card's own
//     type turns out to be), via `engine.ts`'s new `canPlayFromLibraryTop`/
//     `playFromLibraryTop` (reusing the real `playLand`/`canPlayLand`/
//     `castSpell`/`canCastSpell` pairs — real Forge citation:
//     `PlayEffect.java`'s own land-vs-spell dispatch). `dig` (the OLD
//     closest shape) only ever moves cards to hand or the library bottom;
//     this is the real thing. The Regalia (fin/58) hit an ADJACENT version
//     of this same gap for its own attack-triggered "reveal UNTIL a land"
//     effect — that one genuinely needs different (unbounded dig-until)
//     machinery, still open, NOT closed by this pass (see that card's own
//     `definition.ts` comment).
// Modeled as `triggers: [{name:'playFromLibraryTop', effects:[...]}]` below
// — NOT a real CR 603 triggered ability (this clause is a continuous
// granted PERMISSION, not something that triggers), but reusing the same
// "named effect bundle, manually invoked via `pilotFireTrigger`" shape this
// engine already uses for a real triggered ability it can't auto-fire
// (Ultima Weapon's own `onEquippedAttacks`, e.g.) — a pilot script is
// responsible for only invoking this when `attackedThisTurn` is actually
// set on this permanent (the engine primitive itself doesn't know about
// this card's own gating condition, same "engine primitives don't know
// about a specific card's own condition" split `crewedBy`/`declaredTarget`
// already establish elsewhere in this engine). Real fact:
// `event:'play'`/`from:'Library'` (the one guaranteed part of the act; the
// real destination genuinely varies — Battlefield direct for a land, the
// deliberately-invisible Stack for anything else cast — same double
// reasoning `self-enters`'s own omitted `zoneFrom` already uses for an
// omitted zone field), now backed by real trace evidence
// (`cards/the-lunar-whale/scenarios.ts`'s own `runEngineScenarios`) — the
// former `isLunarWhalePlayFromLibraryFact` exemption
// (scripts/verify-synergy.mjs) is removed. Traveling Chocobo (fin/158)
// carries the identical clause ("You may play lands and cast Bird spells
// from the top of your library") and can reuse this same
// `kind:'playFromLibraryTop'` vocabulary once/if migrated (its own
// narrower "lands and Bird spells only" scope is a gate on WHETHER to
// invoke the effect, not a different effect shape).
//
// Crew 1 — same real `crewCost`+`activationCost`+`effects:[animate]`
// machinery Cargo Ship/Magitek Armor/The Prima Vista already establish
// (ENGINE_GAPS.md's Crew N entry, CLOSED) — Forge's own bare `K:Crew:1`
// implicitly makes the Vehicle an artifact creature when crewed, no
// separate scripted SVar anywhere in the real card file.
export const theLunarWhale: CardDefinition = {
  name: 'The Lunar Whale',
  manaCost: '{3}{U}',
  typeLine: 'Legendary Artifact — Vehicle',
  pt: [3, 5],

  keywords: ['Flying'],

  crewCost: 1,
  activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],

  triggers: [
    {
      name: 'playFromLibraryTop',
      effects: [{ kind: 'playFromLibraryTop' } satisfies Effect],
    },
  ],
};
