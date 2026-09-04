import type { CardDefinition, Effect } from '../../card';

export const sazhSChocobo: CardDefinition = {
  name: "Sazh's Chocobo",
  manaCost: '{G}',
  typeLine: 'Creature — Bird',

  pt: [0, 1],

  triggers: [
    {
      name: 'onLandfall',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],
};
