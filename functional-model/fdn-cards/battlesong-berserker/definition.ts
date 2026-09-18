import type { CardDefinition, Effect } from '../../card';

export const battlesongBerserker: CardDefinition = {
  name: 'Battlesong Berserker',
  manaCost: '{3}{R}',
  typeLine: 'Creature — Human Berserker',
  pt: [3, 4],

  triggers: [
    {
      name: 'onAttack',
      on: 'attackersDeclared',
      effects: [
        {
          kind: 'pumpTarget',
          power: 1,
          toughness: 0,
          owner: 'you',
          untilEndOfTurn: true,
        } satisfies Effect,
        {
          kind: 'grantKeywordTarget',
          keyword: 'Menace',
          owner: 'you',
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
