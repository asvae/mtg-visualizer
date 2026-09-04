import type { CardDefinition, Effect } from '../../card';

export const gaiusVanBaelsar: CardDefinition = {
  name: 'Gaius van Baelsar',
  manaCost: '{2}{B}{B}',
  typeLine: 'Legendary Creature — Human Soldier',

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: 'Each player sacrifices a creature token of their choice.',
              effects: [{ kind: 'sacrifice', owner: 'each', validType: 'creature', tokenFilter: 'token' } satisfies Effect],
            },
            {
              describe: 'Each player sacrifices a nontoken creature of their choice.',
              effects: [{ kind: 'sacrifice', owner: 'each', validType: 'creature', tokenFilter: 'nontoken' } satisfies Effect],
            },
            {
              describe: 'Each player sacrifices an enchantment of their choice.',
              effects: [{ kind: 'sacrifice', owner: 'each', validType: 'enchantment' } satisfies Effect],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
