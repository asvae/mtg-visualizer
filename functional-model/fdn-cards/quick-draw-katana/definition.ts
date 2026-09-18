import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const quickDrawKatana: CardDefinition = {
  name: 'Quick-Draw Katana',
  manaCost: '{2}',
  typeLine: 'Artifact — Equipment',

  continuousPTGrants: [{ power: 2, toughness: 0, includeSelf: false, equippedBySelf: true, onlyDuringYourTurn: true }],
  continuousKeywordGrants: [{ keywords: ['FirstStrike'], includeSelf: false, equippedBySelf: true, onlyDuringYourTurn: true }],

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
};
