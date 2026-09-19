import type { CardDefinition, Effect } from '../../card';

export const squadRallier: CardDefinition = {
  name: 'Squad Rallier',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Human Scout',
  pt: [3, 4],
  abilityType: 'activated',
  effects: [
    {
      kind: 'dig',
      qty: 4,
      take: 1,
      validType: 'creature',
      powerLE: 2,
      optional: true,
    } satisfies Effect,
  ],
  activationCost: '{2}{W}',
};
