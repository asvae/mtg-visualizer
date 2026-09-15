import type { CardDefinition, Effect, EffectContext } from '../../card';
import { flashback } from '../../flashback';
import { TOKENS } from '../../tokens.ts';

export const theFinalDays: CardDefinition = {
  name: 'The Final Days',
  manaCost: '{2}{B}{B}',
  typeLine: 'Sorcery',

  alternateCosts: [flashback('{4}{B}{B}')],

  effects: [
    {
      kind: 'createToken',
      token: TOKENS.b_2_2_horror,
      tapped: true,
      amount: (ctx: EffectContext) =>
        ctx.castFrom === 'graveyard' ? ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature()).length : 2,
    } satisfies Effect,
  ],
};
