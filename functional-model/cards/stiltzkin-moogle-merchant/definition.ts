import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const stiltzkinMoogleMerchant: CardDefinition = {
  name: 'Stiltzkin, Moogle Merchant',
  manaCost: '{W}',
  typeLine: 'Legendary Creature — Moogle',

  keywords: ['Lifelink'],

  // {2}, {T}: Target opponent gains control of another target permanent
  // you control. If they do, you draw a card. `gainControl`'s own real
  // signature takes a controller `Player` directly (interfaces.ts), not a
  // chosen-from-a-pool `Card` — there's no `chooseTarget`-equivalent for
  // PICKING a player, so `ctx.opponents[0]` (the same "default to the first
  // opponent" simplification kain-traitorous-dragoon's own custom effect
  // already uses) stands in for "target opponent." The "if they do, draw"
  // gate always fires once a legal permanent target exists — same
  // simplification namazu-trader's own attack-trigger comment documents for
  // "if you do."
  activationCost: '{2}, {T}',
  effects: [
    {
      kind: 'custom',
      describe: 'target opponent gains control of another target permanent you control. If they do, you draw a card.',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Battlefield').filter((c) => c.getId() !== ctx.self.getId());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        const opponent = ctx.opponents[0];
        if (!opponent) return;
        actions.gainControl(opponent, target);
        ctx.you.drawCard();
      },
    } satisfies Effect,
  ],
};
