import type { CardDefinition, Effect } from '../../card';

export const inspirationFromBeyond: CardDefinition = {
  name: 'Inspiration from Beyond',
  provenance: 'forge-json-compiler',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',
  abilityType: 'spell',
  alternateCosts: [
    {
      name: 'Flashback',
      cost: '{5}{U}{U}',
      from: 'graveyard',
      thenExile: true,
    },
  ],
  effects: [
    {
      kind: 'mill',
      owner: 'you',
      amount: 3,
    } satisfies Effect,
    {
      kind: 'move',
      from: 'Graveyard',
      to: 'Hand',
      qty: 1,
      validType: 'any',
      target: true,
      owner: 'you',
      subtype: ['Instant', 'Sorcery'],
    } satisfies Effect,
  ],
};
