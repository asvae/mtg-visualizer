import type { CardDefinition, Effect } from '../../card';

export const raiseThePast: CardDefinition = {
  name: 'Raise the Past',
  manaCost: '{2}{W}{W}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'move',
      owner: 'you',
      from: 'Graveyard',
      to: 'Battlefield',
      validType: 'creature',
      maxCmc: 2,
      qty: 100,
    } satisfies Effect,
  ],
};
