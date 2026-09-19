import type { CardDefinition, Effect } from '../../card';

export const refute: CardDefinition = {
  name: 'Refute',
  provenance: 'forge-json-compiler',
  manaCost: '{1}{U}{U}',
  typeLine: 'Instant',
  abilityType: 'spell',
  effects: [
    {
      kind: 'counter',
      describe: 'target spell',
    } satisfies Effect,
    {
      kind: 'drawCard',
      amount: 1,
    } satisfies Effect,
    {
      kind: 'discard',
      owner: 'you',
      qty: 1,
    } satisfies Effect,
  ],
};
