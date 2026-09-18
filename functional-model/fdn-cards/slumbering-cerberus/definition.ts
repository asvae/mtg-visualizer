import type { CardDefinition } from '../../card';

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
