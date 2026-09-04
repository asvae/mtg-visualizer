import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const bardsBow: CardDefinition = {
  name: "Bard's Bow",
  manaCost: '{2}{G}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +2/+2, has reach, and is a Bard in addition to
  // its other types" — a continuous grant to whatever this is attached to,
  // not a CDA on this card itself (no `ptFormula` shape fits an equipment's
  // own grant to its target) — real text, same convention dragoon-s-lance's
  // own Equipment grant already uses.
  staticAbilities: ['Equipped creature gets +2/+2, has reach, and is a Bard in addition to its other types.'],

  // Job select — "When this Equipment enters, create a 1/1 colorless Hero
  // creature token, then attach this to it." Same real ETB trigger shape
  // (and same real token) as dragoon-s-lance's own Job select.
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

  // Perseus's Bow — Equip {6}, a flavor name on the standard Equip ability.
  activationCost: 'Equip {6}',
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
