import type { CardDefinition, Effect } from '../../card';

export const craterhoofBehemoth: CardDefinition = {
  name: 'Craterhoof Behemoth',
  manaCost: '{5}{G}{G}{G}',
  typeLine: 'Creature — Beast',
  pt: [5, 5],
  keywords: ['Haste'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'grantKeywordAll',
          predicate: 'creatures-you-control',
          keyword: 'Trample',
        } satisfies Effect,
        {
          kind: 'pumpAll',
          predicate: 'creatures-you-control',
          power: (ctx) => ctx.you.getCreaturesInPlay().length,
          toughness: (ctx) => ctx.you.getCreaturesInPlay().length,
        } satisfies Effect,
      ],
    },
  ],
};
