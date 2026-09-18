import type { CardDefinition, Effect } from '../../card';

export const riteOfTheDragoncaller: CardDefinition = {
  name: 'Rite of the Dragoncaller',
  manaCost: '{4}{R}{R}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onCastInstantOrSorcery',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Dragon', manaCost: '0', types: ['Creature', 'Dragon'], basePower: 5, baseToughness: 5, keywords: ['Flying'] },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
