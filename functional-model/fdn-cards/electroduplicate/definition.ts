import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const electroduplicate: CardDefinition = {
  name: 'Electroduplicate',
  manaCost: '{2}{R}',
  typeLine: 'Sorcery',

  alternateCosts: [flashback('{2}{R}{R}')],

  effects: [
    {
      kind: 'custom',
      describe:
        "create a token that's a copy of target creature you control, except it has haste and \"At the beginning of the end step, sacrifice this token.\"",
      run: (ctx, actions) => {
        const pool = ctx.you.getCreaturesInPlay();
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        if (!target) return;
        const copy = actions.copyPermanent(target, ctx.you);
        actions.grantKeyword(copy, 'Haste');
        actions.delayUntil('EndOfTurn', () => {
          actions.moveTo(copy, 'Graveyard');
        });
      },
    } satisfies Effect,
  ],
};
