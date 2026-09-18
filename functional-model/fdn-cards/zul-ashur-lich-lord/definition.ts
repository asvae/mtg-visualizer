import type { CardDefinition, Effect } from '../../card';

export const zulAshurLichLord: CardDefinition = {
  name: 'Zul Ashur, Lich Lord',
  manaCost: '{1}{B}',
  typeLine: 'Legendary Creature — Zombie Warlock',
  pt: [2, 2],

  keywords: ['Ward'],
  keywordCosts: [{ keyword: 'Ward', cost: 'Pay 2 life' }],

  abilities: [
    {
      name: 'castFromGraveyard',
      cost: '{T}',
      effects: [
        {
          kind: 'custom',
          describe:
            'you may cast target Zombie creature card from your graveyard this turn (no MayPlay/standing-permission mechanic exists anywhere in this engine)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
