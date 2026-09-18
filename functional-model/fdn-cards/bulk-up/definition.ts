import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const bulkUp: CardDefinition = {
  name: 'Bulk Up',
  manaCost: '{1}{R}',
  typeLine: 'Instant',

  alternateCosts: [flashback('{4}{R}{R}')],

  effects: [
    {
      // "Double target creature's power until end of turn."
      kind: 'custom',
      describe: "double target creature's power until end of turn",
      run: (ctx, actions) => {
        const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        if (target) actions.pump(target, target.getNetPower(), 0, { untilEndOfTurn: true });
      },
    } satisfies Effect,
  ],
};
