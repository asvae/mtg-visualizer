import type { CardDefinition, Effect } from '../../card';

export const elfswornGiant: CardDefinition = {
  name: 'Elfsworn Giant',
  manaCost: '{3}{G}{G}',
  typeLine: 'Creature — Giant',
  pt: [5, 3],
  keywords: ['Reach'],

  triggers: [
    {
      name: 'onLandfall',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Elf Warrior', manaCost: '0', types: ['Creature', 'Elf', 'Warrior'], basePower: 1, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
