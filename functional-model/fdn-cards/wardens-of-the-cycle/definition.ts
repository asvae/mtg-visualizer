import type { CardDefinition } from '../../card';

export const wardensOfTheCycle: CardDefinition = {
  name: 'Wardens of the Cycle',
  manaCost: '{1}{B}{G}{G}',
  typeLine: 'Creature — Elf Warlock',
  pt: [3, 4],

  missingSchemaFunctionality: [
    {
      clause: 'Morbid — At the beginning of your end step, if a creature died this turn, choose one — • You gain 2 life. • You draw a card and you lose 1 life.',
      demand:
        'No "did a creature died this turn" (Morbid) tracking exists anywhere in this engine — `BoardStateCondition` only has `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`.',
    },
  ],
};
