import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const samuraisKatana: CardDefinition = {
  name: "Samurai's Katana",
  manaCost: '{2}{R}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +2/+2, has trample and haste, and is a Samurai in addition to its other types.'],

  // Job select — same real ETB mechanic as dragoon-s-lance/thief-s-knife/
  // machinist-s-arsenal/paladin-s-arms' own onEnter trigger.
  triggers: [
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
  ],

  // Murasame — Equip {5}, a flavor name on the standard Equip ability, same
  // attach-to-a-chosen-creature shape as dragoon-s-lance's own Gae Bolg.
  activationCost: '{5}',
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
