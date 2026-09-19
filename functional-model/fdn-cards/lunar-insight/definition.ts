import type { CardDefinition, Effect } from '../../card';

export const lunarInsight: CardDefinition = {
  name: 'Lunar Insight',
  provenance: 'forge-json-compiler',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',
  abilityType: 'spell',
  effects: [
    {
      kind: 'drawCard',
      amount: NaN,
    } satisfies Effect,
  ],
};
