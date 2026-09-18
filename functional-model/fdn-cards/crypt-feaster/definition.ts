import type { CardDefinition, Effect } from '../../card';

export const cryptFeaster: CardDefinition = {
  name: 'Crypt Feaster',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Zombie',
  pt: [3, 4],

  keywords: ['Menace'],

  // "Threshold — Whenever this creature attacks, if there are seven or
  // more cards in your graveyard, this creature gets +2/+0 until end of
  // turn."
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      condition: { kind: 'graveyardCountAtLeast', min: 7 },
      effects: [
        {
          kind: 'pumpSelf',
          power: 2,
          toughness: 0,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
