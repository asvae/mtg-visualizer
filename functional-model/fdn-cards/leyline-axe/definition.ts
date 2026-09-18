import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const leylineAxe: CardDefinition = {
  name: 'Leyline Axe',
  manaCost: '{4}',
  typeLine: 'Artifact — Equipment',

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],
  continuousKeywordGrants: [{ keywords: ['DoubleStrike', 'Trample'], includeSelf: false, equippedBySelf: true }],

  activationCost: '{3}',
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

  missingSchemaFunctionality: [
    {
      clause: 'If this card is in your opening hand, you may begin the game with it on the battlefield.',
      demand: 'No deck-building/game-setup special-action mechanism exists anywhere in this engine — there is no "opening hand"/game-start concept at all outside a scenario\'s own fixed starting board.',
    },
  ],
};
