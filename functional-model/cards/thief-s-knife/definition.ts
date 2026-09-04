import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const thiefsKnife: CardDefinition = {
  name: "Thief's Knife",
  manaCost: '{2}{U}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+1 and is a Rogue in addition to its other types.'],

  triggers: [
    // Job select — same real ETB mechanic as sage-s-nouliths/dragoon-s-
    // lance/machinist-s-arsenal/paladin-s-arms' own onEnter trigger.
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'create a 1/1 colorless Hero creature token, then attach this to it',
          run: (ctx: EffectContext, actions: Actions) => {
            const [created] = actions.createToken(ctx.you, TOKENS.c_1_1_hero, 1);
            if (created) actions.equip(ctx.self, created);
          },
        } satisfies Effect,
      ],
    },
    // The granted "whenever this creature deals combat damage to a player,
    // draw a card" — granted TO the equipped creature by Thief's Knife's
    // own static ability, modeled as if it were Thief's Knife's own
    // trigger, same simplification ninja-s-blades' own
    // `onEquippedDealsDamage` documents. Unlike Ninja's Blades' own
    // granted trigger, this one is a plain draw — no `custom` needed.
    {
      name: 'onEquippedDealsDamage',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect],
    },
  ],

  // Equip {4} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape as dragoon-s-lance/machinist-s-arsenal/paladin-s-arms.
  activationCost: '{4}',
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
};
