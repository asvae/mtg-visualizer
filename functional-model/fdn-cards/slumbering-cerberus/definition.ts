import type { CardDefinition } from '../../card';

// Real Forge (slumbering_cerberus.txt):
//   `R:Event$ Untap | ValidCard$ Card.Self | ValidStepTurnToController$ You
//   | Layer$ CantHappen` — "This creature doesn't untap during your untap
//   step." Real, PRINTED (not granted) `'CantUntap'` keyword — `state.ts`'s
//   own `effectiveKeywords` starts from `card.keywords` directly, so a
//   printed entry here is genuinely enforced at the same `state.untap`
//   chokepoint the granted (Sleep Magic) case already uses.
//   `T:Mode$ Phase | Phase$ End of Turn | CheckSVar$ X | ... |
//   SVar:X:Count$ThisTurnEntered_Graveyard_from_Battlefield_Creature` —
//   Morbid ("if a creature died this turn"), gating "untap this creature"
//   at EACH end step (not just yours). GENUINE CAPACITY GAP: no live "did a
//   creature die this turn" tracking exists anywhere in this engine
//   (grepped, zero hits outside this comment/tragic-banshee's own identical
//   documented gap) — `BoardStateCondition`'s 2026-09-18 closure only added
//   Threshold/Raid/self-counter-count variants, none of which cover Morbid.
export const slumberingCerberus: CardDefinition = {
  name: 'Slumbering Cerberus',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Dog',
  pt: [4, 2],
  keywords: ['CantUntap'],

  missingSchemaFunctionality: [
    {
      clause: 'Morbid — At the beginning of each end step, if a creature died this turn, untap this creature.',
      demand:
        'No "did a creature died this turn" (Morbid) tracking exists anywhere in this engine — `BoardStateCondition` only has `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`. Also needs an EACH-player end-step trigger scope (`Trigger.on:\'endStep\'` only fires for the active player\'s own permanents, not "each end step" for both players).',
    },
  ],
};
