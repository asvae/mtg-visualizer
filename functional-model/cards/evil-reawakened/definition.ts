import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const evilReawakened: CardDefinition = {
  name: 'Evil Reawakened',
  manaCost: '{4}{B}',
  typeLine: 'Sorcery',

  effects: [
    {
      // "Return target creature card from your graveyard to the
      // battlefield WITH two additional +1/+1 counters on IT" — the SAME
      // object the move just returned. `move`'s own targeted branch has no
      // field for "then put counters on what was moved," and `putCounter`/
      // `putCounterTarget` can't be pointed at "whatever the previous
      // effect just chose" (no cross-effect target binding exists anywhere
      // in this model) — `custom`, picking one real graveyard creature and
      // chaining `moveTo` then `putCounter` on that same object, is the
      // honest shape (same real limitation phoenix-down's own "return...to
      // the battlefield tapped" comment documents).
      kind: 'custom',
      describe: 'return target creature card from your graveyard to the battlefield with two additional +1/+1 counters on it',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        actions.moveTo(target, 'Battlefield');
        actions.putCounter(target, '+1/+1', 2);
      },
    } satisfies Effect,
  ],
};
