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
      on: 'enter',
      effects: [
        // Real Forge (tmp/mtg-forge/.../c/craterhoof_behemoth.txt) —
        // "creatures you control gain trample and get +X/+X UNTIL END OF
        // TURN, where X is the number of creatures you control." Both
        // effects were missing `untilEndOfTurn: true` (2026-09-15 fix,
        // fin/26-50 pass) — same systemic omission bug class fixed pool-wide
        // earlier this session.
        {
          kind: 'grantKeywordAll',
          predicate: 'creatures-you-control',
          keyword: 'Trample',
          untilEndOfTurn: true,
        } satisfies Effect,
        {
          kind: 'pumpAll',
          predicate: 'creatures-you-control',
          power: (ctx) => ctx.you.getCreaturesInPlay().length,
          toughness: (ctx) => ctx.you.getCreaturesInPlay().length,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
