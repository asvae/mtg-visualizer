import type { CardDefinition, Effect } from '../../card';

export const squadRallier: CardDefinition = {
  name: 'Squad Rallier',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Human Scout',
  pt: [3, 4],

  activationCost: '{2}{W}',
  effects: [
    {
      kind: 'dig',
      qty: 4,
      take: 1,
      validType: 'creature-or-artifact',
      optional: true,
    } satisfies Effect,
  ],
};
