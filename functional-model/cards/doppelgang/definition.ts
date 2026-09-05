import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const doppelgang: CardDefinition = {
  name: 'Doppelgang',
  manaCost: '{X}{X}{X}{G}{U}',
  typeLine: 'Sorcery',

  effects: [
    {
      // "For each of X target permanents, create X tokens that are copies
      // of that permanent." No declarative shape for "target N permanents,
      // then copy each N times" — custom, using the real injectable
      // `copyPermanent` action (one copy per call, so X targets * X
      // copies each = a nested loop).
      kind: 'custom',
      describe: 'for each of X target permanents, create X tokens that are copies of that permanent',
      run: (ctx: EffectContext, actions: Actions) => {
        const x = ctx.xPaid ?? 0;
        const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Battlefield'));
        const targets = [];
        for (let i = 0; i < x; i++) {
          const remaining = pool.filter((c) => !targets.includes(c));
          if (remaining.length === 0) break;
          targets.push(actions.chooseTarget(remaining));
        }
        for (const target of targets) {
          for (let i = 0; i < x; i++) actions.copyPermanent(target, ctx.you);
        }
      },
    } satisfies Effect,
  ],
};
