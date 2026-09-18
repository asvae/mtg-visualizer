import type { CardDefinition, Effect } from '../../card';

export const vengefulBloodwitch: CardDefinition = {
  name: 'Vengeful Bloodwitch',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Vampire Warlock',
  pt: [1, 1],

  triggers: [
    {
      name: 'onDies',
      effects: [
        { kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect,
        { kind: 'gainLife', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
