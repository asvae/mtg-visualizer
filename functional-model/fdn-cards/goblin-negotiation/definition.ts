import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const goblinNegotiation: CardDefinition = {
  name: 'Goblin Negotiation',
  manaCost: '{X}{R}{R}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'custom',
      describe:
        'deal X damage to target creature, then create a number of 1/1 red Goblin creature tokens equal to the excess damage dealt to that creature this way',
      run: (ctx: EffectContext, actions: Actions) => {
        const x = ctx.xPaid ?? 0;
        const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        if (!target) return;
        actions.dealDamage(ctx.self, target, x);
        const excess = Math.max(0, x - target.getNetToughness());
        if (excess > 0) {
          actions.createToken(ctx.you, { name: 'Goblin', manaCost: '0', types: ['Creature', 'Goblin'], basePower: 1, baseToughness: 1 }, excess);
        }
      },
    } satisfies Effect,
  ],
};
