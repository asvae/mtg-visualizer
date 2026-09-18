import type { CardDefinition, Effect } from '../../card';

export const eruditeWizard: CardDefinition = {
  name: 'Erudite Wizard',
  manaCost: '{2}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [2, 3],

  triggers: [
    {
      name: 'onSecondDraw',
      on: 'drawNthCardThisTurn',
      drawNthCardThisTurnNumber: 2,
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
