import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const paladinsArms: CardDefinition = {
  name: "Paladin's Arms",
  manaCost: '{2}{W}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +2/+1, has ward {1}, and is a Knight in addition to its other types.'],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance/machinist-s-arsenal's own onEnter trigger;
  // independent of the Equip ability below, so both fit without the
  // one-activated-ability-slot conflict those cards' own comments document.
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

  // Lightbringer and Hero's Shield — Equip {4}, a flavor name on the
  // standard Equip ability, same shape dragoon-s-lance/machinist-s-arsenal
  // already use.
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
