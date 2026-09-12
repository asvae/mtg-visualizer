import type { CardDefinition, Effect } from '../../card';

// Real oracle text (data/fin/fin_scryfall.json, fin/80, mana_cost {X}{U}):
// "Counter target spell unless its controller pays {X}. If that spell is
// countered this way, exile it instead of putting it into its owner's
// graveyard."
//
// `kind:'counter'` (card.ts, interfaces.ts's own `counter` doc comment) is
// the SAME log-only primitive Louisoix's Sacrifice's own "Counter target
// activated ability, triggered ability, or noncreature spell" already
// uses — this engine has no stack/object model that lets a resolving spell
// actually remove a DIFFERENT object from the stack, so there is nothing a
// real target reference could point at and remove in the first place;
// `describe` is a free-text record of what got countered (and, here,
// under what condition/consequence), same as Louisoix's Sacrifice.
//
// Two real things Syncopate's own text adds beyond Louisoix's shape,
// both checked against the actual engine surface rather than assumed
// unsupported:
//
// 1. "unless its controller pays {X}" is a conditional branch keyed on
//    ANOTHER player's own choice made DURING this spell's resolution — not
//    a choice this card's own caster makes (contrast Louisoix's own
//    "sacrifice a legendary creature OR pay {2}", a real modal/`ctx.mode`
//    choice the CASTER makes at cast time, a genuinely different shape).
//    This engine has no player-decision process anywhere (ENGINE_GAPS.md's
//    own "Accepted simplifications": "every round's choices are supplied
//    by the caller, not decided by anything in this codebase") — there is
//    no hook for an OPPOSING player to be offered a real choice
//    mid-resolution, so this can't genuinely branch. `actions.counter(...)`
//    fires unconditionally either way, same as Louisoix's own call — this
//    is not a new regression specific to this card, it is the same
//    log-only ceiling `kind:'counter'` already has for every card that uses
//    it (checked: no FIN card anywhere models a real "unless an OPPONENT
//    pays" branch — the closest precedent, Louisoix's own additional cost,
//    is the CASTER's choice, a structurally different, already-solved
//    shape).
// 2. "exile it instead of ... graveyard" — a real, would-be conditional
//    zone destination for the countered spell. Checked whether this could
//    be modeled as a real `to`/`from` zone fact (the current, unified
//    `Fact` shape lets `to`/`from` freely co-occur with `event` — see
//    SYNERGY_DESIGN.md's "Fact unification") rather than assumed
//    unsupported by the OLD zoneFrom/zoneTo-is-documentary-only design
//    (superseded, see synergy.ts's own `Fact.zone`/`Fact.to` doc comments —
//    those fields are no longer purely descriptive, adding either would
//    make this fact genuinely ZONE-shaped for matching purposes). Rejected:
//    the object being exiled is a FOREIGN spell of UNSPECIFIED type/
//    controller (this card's own "target spell" has no type restriction at
//    all, unlike Louisoix's own "noncreature spell"), so there is no real
//    `subject`/`controller` this fact could honestly assert for it — the
//    one real zone-shaped "wants a Creature in Exile, controller you" sink
//    in the pool today (the-darkness-crystal) would risk a false-positive
//    match if this fact claimed `to:'Exile'` with no way to verify the
//    countered spell is actually a creature OR actually belongs to `you`.
//    Captured ONLY as descriptive text in `describe`, not as a new zone
//    field — same "don't grow the vocabulary speculatively" discipline
//    Constraints' own doc comment states, applied here to `to`/`from`.
const counterEffect: Effect = {
  kind: 'counter',
  describe: "Counter target spell unless its controller pays {X}. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.",
};

export const syncopate: CardDefinition = {
  name: 'Syncopate',
  manaCost: '{X}{U}',
  typeLine: 'Instant',

  effects: [counterEffect],
};
