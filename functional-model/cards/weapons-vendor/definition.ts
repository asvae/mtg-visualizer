import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const weaponsVendor: CardDefinition = {
  name: 'Weapons Vendor',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Human Artificer',

  pt: [2, 2],

  triggers: [
    { name: 'onEnter', effects: [{ kind: 'drawCard' } satisfies Effect] },
    {
      // "At the beginning of combat on your turn, if you control an
      // Equipment, you may pay {1}. When you do, attach target Equipment
      // you control to target creature you control." — real conditional +
      // optional-payment + intervening-if shape; no cost-payment/`ActivationLimit`-
      // style machinery exists in this model (this model has no player-
      // decision engine anywhere — same simplification namazu-trader's own
      // "if you do" gate already documents: the payoff always happens once
      // a legal target exists). `equip` has no declarative Effect kind (see
      // dragoon-s-lance/paladin-s-arms/machinist-s-arsenal's own comments)
      // — `custom` calling the real `actions.equip` directly, gated on
      // actually controlling an Equipment, models the real shape.
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'custom',
          describe: 'if you control an Equipment, you may pay {1}. When you do, attach target Equipment you control to target creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            const equipment = ctx.you.getCardsIn('Battlefield').filter((c) => c.hasSubtype('Equipment'));
            const creatures = ctx.you.getCreaturesInPlay();
            if (equipment.length === 0 || creatures.length === 0) return;
            actions.equip(actions.chooseTarget(equipment), actions.chooseTarget(creatures));
          },
        } satisfies Effect,
      ],
    },
  ],
};
