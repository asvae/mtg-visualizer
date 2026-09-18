import type { CardDefinition, Effect } from '../../card';

export const valkyriesCall: CardDefinition = {
  name: "Valkyrie's Call",
  manaCost: '{3}{W}{W}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onYourCreatureDeath',
      effects: [
        {
          kind: 'move',
          from: 'Graveyard',
          to: 'Battlefield',
          validType: 'creature',
          qty: 1,
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
