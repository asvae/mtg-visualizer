import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const coliseumBehemoth: CardDefinition = {
  name: 'Coliseum Behemoth',
  manaCost: '{5}{G}{G}',
  typeLine: 'Creature — Beast',

  pt: [7, 7],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: 'Destroy target artifact or enchantment.',
              effects: [
                {
                  // `destroy`'s own `validType` union (`'permanent' |
                  // 'creature' | 'land'`) has no "artifact or enchantment"
                  // option — 'permanent' would incorrectly widen the legal
                  // target pool to creatures/lands too. `custom`, filtering
                  // the real battlefield pool by `isArtifact() ||
                  // isEnchantment()` then calling the real `actions.destroy`,
                  // is the honest shape for just this one mode.
                  kind: 'custom',
                  describe: 'destroy target artifact or enchantment',
                  run: (ctx: EffectContext, actions: Actions) => {
                    const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter((c) => c.isArtifact() || c.isEnchantment());
                    if (pool.length === 0) return;
                    actions.destroy(actions.chooseTarget(pool));
                  },
                } satisfies Effect,
              ],
            },
            { describe: 'Draw a card.', effects: [{ kind: 'drawCard' } satisfies Effect] },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
