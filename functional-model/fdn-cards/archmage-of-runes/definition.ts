import type { CardDefinition, Effect } from '../../card';

export const archmageOfRunes: CardDefinition = {
  name: 'Archmage of Runes',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Giant Wizard',
  pt: [3, 6],

  triggers: [
    {
      name: 'onInstantOrSorceryCast',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
