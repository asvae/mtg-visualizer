import type { CardDefinition, Effect } from '../../card';

export const ilMhegPixie: CardDefinition = {
  name: 'Il Mheg Pixie',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Faerie',
  pt: [2, 1],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'surveil', qty: 1 } satisfies Effect],
    },
  ],
};
