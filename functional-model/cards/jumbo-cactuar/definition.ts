import type { CardDefinition, Effect } from '../../card';

export const jumboCactuar: CardDefinition = {
  name: 'Jumbo Cactuar',
  manaCost: '{5}{G}{G}',
  typeLine: 'Creature — Plant',

  pt: [1, 7],

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'pumpSelf', power: 9999, toughness: 0 } satisfies Effect],
    },
  ],
};
