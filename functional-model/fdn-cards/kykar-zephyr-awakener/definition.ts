import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const kykarZephyrAwakener: CardDefinition = {
  name: 'Kykar, Zephyr Awakener',
  manaCost: '{2}{W}{U}',
  typeLine: 'Legendary Creature — Bird Wizard',
  pt: [3, 4],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onCastNoncreatureSpell',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: "Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
              effects: [
                {
                  // Real Forge (kykar_zephyr_awakener.txt): `DB$ ChangeZone |
                  // ValidTgts$ Creature.YouCtrl+Other | ... | Destination$
                  // Exile | ... | SubAbility$ DelTrig` then `SVar:DelTrig:DB$
                  // DelayedTrigger | Mode$ Phase | Phase$ End of Turn |
                  // Execute$ TrigReturn ...` — a real 603.4/603.7 delayed
                  // trigger, same shape Elrond, Moon-Reader's own "next end
                  // step" clause already uses via `actions.delayUntil`
                  // (functional-model/interfaces.ts). No "no delayed-trigger
                  // primitive" gap here — `delayUntil` IS that primitive.
                  kind: 'custom',
                  describe: "exile another target creature you control, then return it to the battlefield under its owner's control at the beginning of the next end step",
                  run: (ctx: EffectContext, actions: Actions) => {
                    const pool = ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId());
                    if (pool.length === 0) return;
                    const target = actions.chooseTarget(pool);
                    actions.moveTo(target, 'Exile');
                    actions.delayUntil('EndOfTurn', () => {
                      actions.moveTo(target, 'Battlefield');
                    });
                  },
                } satisfies Effect,
              ],
            },
            {
              describe: 'Create a 1/1 white Spirit creature token with flying.',
              effects: [
                {
                  kind: 'createToken',
                  token: { name: 'Spirit', manaCost: '0', types: ['Creature', 'Spirit'], basePower: 1, baseToughness: 1, keywords: ['Flying'] },
                  amount: 1,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
