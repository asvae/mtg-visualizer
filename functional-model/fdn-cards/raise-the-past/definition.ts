import type { CardDefinition, Effect } from '../../card';

export const raiseThePast: CardDefinition = {
  name: 'Raise the Past',
  provenance: 'forge-json-compiler',
  manaCost: '{2}{W}{W}',
  typeLine: 'Sorcery',
  abilityType: 'spell',
  effects: [
    {
      kind: 'move',
      from: 'Graveyard',
      to: 'Battlefield',
      qty: 100,
      validType: 'creature',
      owner: 'you',
      maxCmc: 2,
    } satisfies Effect,
  ],
};
