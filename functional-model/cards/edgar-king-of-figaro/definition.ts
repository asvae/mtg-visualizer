import type { CardDefinition, Effect } from '../../card';

export const edgarKingOfFigaro: CardDefinition = {
  name: 'Edgar, King of Figaro',
  manaCost: '{4}{U}{U}',
  typeLine: 'Legendary Creature — Human Artificer Noble',

  pt: [4, 5],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'drawCard',
          // Real `NumCards$ Count$Valid Artifact.YouCtrl` — a live count
          // read at resolution, the `Computed<number>` escape hatch's own
          // canonical use (a real cross-state read, not a fixed value).
          amount: (ctx) => ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact()).length,
        } satisfies Effect,
      ],
    },
  ],

  // "Two-Headed Coin — The first time you flip one or more coins each
  // turn, those coins come up heads and you win those flips." No coin-flip
  // mechanism anywhere in this model (no card built so far needs one) —
  // real, structured text only, same treatment fate-of-the-sun-cryst's own
  // cost-reduction static gets.
  staticAbilities: ['Two-Headed Coin — The first time you flip one or more coins each turn, those coins come up heads and you win those flips.'],
};
