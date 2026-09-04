import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const ninjasBlades: CardDefinition = {
  name: "Ninja's Blades",
  manaCost: '{2}{B}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: [
    'Job select (this Equipment attaches to a creature you control as it enters, or gets a bonus of your choice — the underlying Job-select mechanic isn\'t modeled here, only its printed continuous effect below is).',
    'Equipped creature gets +1/+1 and is a Ninja in addition to its other types.',
  ],

  // Equip {2} — an activated ability on the Equipment itself, same
  // activationCost/effects shape as Warren Elder's pump ability; the effect
  // is attaching, not a resolution payoff.
  activationCost: '{2}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],

  // The granted "whenever this creature deals combat damage to a player,
  // draw a card, then discard a card. That player loses life equal to the
  // discarded card's mana value" — granted TO the equipped creature by
  // Ninja's Blades' own static ability, modeled here as if it were Ninja's
  // Blades' own trigger (a simplification — the real source is whichever
  // creature is equipped, not this permanent).
  triggers: [
    {
      name: 'onEquippedDealsDamage',
      effects: [
        {
          kind: 'custom',
          describe: "draw, then discard a card; that player loses life equal to the discarded card's mana value",
          run: (ctx: EffectContext, actions: Actions) => {
            ctx.you.drawCard();
            actions.discard(ctx.you, 1);
            const manaValue = (ctx.triggerInput?.discardedCardManaValue as number) ?? 0;
            const damagedPlayer = ctx.opponents[(ctx.triggerInput?.damagedPlayerIndex as number) ?? 0];
            damagedPlayer?.loseLife(manaValue);
          },
        } satisfies Effect,
      ],
    },
  ],
};
