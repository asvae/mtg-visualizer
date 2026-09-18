import type { CardDefinition, Effect } from '../../card';

export const hungryGhoul: CardDefinition = {
  name: 'Hungry Ghoul',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Zombie',
  pt: [2, 2],

  activationCost: '{1}, sacrifice another creature',
  effects: [
    {
      kind: 'putCounter',
      target: 'self',
      counterType: '+1/+1',
      amount: 1,
    } satisfies Effect,
  ],
};
