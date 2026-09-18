import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const celestialArmor: CardDefinition = {
  name: 'Celestial Armor',
  manaCost: '{2}{W}',
  typeLine: 'Artifact — Equipment',
  keywords: ['Flash'],

  // Equipped creature gets +2/+0 and has flying
  continuousPTGrants: [{ power: 2, toughness: 0, includeSelf: false, equippedBySelf: true }],
  continuousKeywordGrants: [{ keywords: ['Flying'], includeSelf: false, equippedBySelf: true }],

  // When this Equipment enters, attach it to target creature you control.
  // That creature gains hexproof and indestructible until end of turn.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'attach to target creature you control; that creature gains hexproof and indestructible until end of turn',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) {
              actions.equip(ctx.self, target);
              // Grant hexproof and indestructible until end of turn
              actions.grantKeyword(target, 'Hexproof', { untilEndOfTurn: true });
              actions.grantKeyword(target, 'Indestructible', { untilEndOfTurn: true });
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  // Equip {3}{W}
  activationCost: '{3}{W}',
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
