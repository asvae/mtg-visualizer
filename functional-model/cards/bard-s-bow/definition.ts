import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const bardsBow: CardDefinition = {
  name: "Bard's Bow",
  manaCost: '{2}{G}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +2/+2, has reach, and is a Bard in addition to
  // its other types" — real, mechanical `continuousPTGrants`/
  // `continuousTypeGrants`/`continuousKeywordGrants` (2026-09-16,
  // static-ability audit follow-up — same already-real query-time
  // machinery dragoon-s-lance's own Equipment grant already uses).
  staticAbilities: ['Equipped creature gets +2/+2, has reach, and is a Bard in addition to its other types.'],

  continuousPTGrants: [{ power: 2, toughness: 2, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Bard'], includeSelf: false, equippedBySelf: true }],
  continuousKeywordGrants: [{ keywords: ['Reach'], includeSelf: false, equippedBySelf: true }],

  // Job select — "When this Equipment enters, create a 1/1 colorless Hero
  // creature token, then attach this to it." Same real ETB trigger shape
  // (and same real token) as dragoon-s-lance's own Job select.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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
