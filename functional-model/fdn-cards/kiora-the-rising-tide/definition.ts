import type { CardDefinition, Effect } from '../../card';

export const kioraTheRisingTide: CardDefinition = {
  name: 'Kiora, the Rising Tide',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Merfolk Noble',
  pt: [3, 2],
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        { kind: 'drawCard', amount: 2 } satisfies Effect,
        { kind: 'discard', owner: 'you', qty: 2 } satisfies Effect,
      ],
    },
    {
      name: 'onAttack',
      on: 'attacks',
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Scion of the Deep',
            manaCost: '0',
            types: ['Legendary', 'Creature', 'Octopus'],
            basePower: 8,
            baseToughness: 8,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
