import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Same real shape as white-mage-s-staff (Job select ETB + a static
// equipped-creature bonus + a real Equip ability) — only the stats/cost
// differ.
export const warriorsSword: CardDefinition = {
  name: "Warrior's Sword",
  manaCost: '{3}{R}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +3/+2 and is a Warrior in addition to its other types.'],

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
