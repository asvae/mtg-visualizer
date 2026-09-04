import type { CardDefinition, Effect } from '../../card';

export const loporritScout: CardDefinition = {
  name: 'Loporrit Scout',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Rabbit Scout',

  pt: [3, 2],

  triggers: [
    {
      name: 'onOtherCreatureEnters',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 1 } satisfies Effect],
    },
  ],
};
