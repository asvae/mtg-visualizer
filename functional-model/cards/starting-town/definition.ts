import type { CardDefinition } from '../../card';

// Real script (starting_town.txt): "This land enters tapped UNLESS it's
// your first, second, or third turn of the game" — a real CONDITIONAL
// ETBTapped replacement (`ConditionCheckSVar$ X | ConditionSVarCompare$
// GT3`, X keyed off `Count$YourTurns`). Unlike every other Town in this
// batch (whose "enters tapped" is unconditional, modeled as a plain
// onEnter `tapTarget` trigger), this one's condition depends on the
// CURRENT TURN NUMBER — `EffectContext` has no turn-count field anywhere
// (only a declared-but-unwired `isYourTurn(player): boolean` exists in
// interfaces.ts, a same-turn boolean, not a turn-number counter), so the
// condition itself can't be evaluated. Modeling this as an unconditional
// tap (like its siblings) would misrepresent the card's whole point
// (staying untapped in the early game); modeling it as always-untapped
// would be equally wrong once turn 4+ arrives. Left as static text rather
// than guessing either way — a real gap: no turn-number state exposed to
// any Effect/Computed function.
//
// The two mana abilities ({T}: Add {C}; {T}, Pay 1 life: Add one mana of
// any color) are real mana-producing abilities — no mana-producing
// Effect/Action exists anywhere in this model, the documented STILL-
// DEFERRED gap. All three stay static text — there is no declarative
// onEnter/effects/abilities entry on this card at all.
export const startingTown: CardDefinition = {
  name: 'Starting Town',
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: [
    "This land enters tapped unless it's your first, second, or third turn of the game.",
    '{T}: Add {C}.',
    '{T}, Pay 1 life: Add one mana of any color.',
  ],
};
