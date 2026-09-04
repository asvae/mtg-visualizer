import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (magitek_scythe.txt): "A Test of Your Reflexes! — When this
// Equipment enters, you may attach it to target creature you control. If
// you do, that creature gains first strike until end of turn and must be
// blocked this turn if able." Same attach-then-grant-keyword split
// coral-sword's own onEnter trigger already establishes (`custom` for the
// real `DB$ Attach` step, `grantKeywordTarget` for the declarative
// first-strike grant); "must be blocked this turn if able" is a granted
// combat/blocking RESTRICTION with no equivalent anywhere in this model (no
// attack/block/damage-assignment step exists at all — state.ts's own
// header), kept as a no-op `custom` purely so `synergyTags()` still sees
// the real text, same treatment buster-sword's own free-cast clause gets.
export const magitekScythe: CardDefinition = {
  name: 'Magitek Scythe',
  manaCost: '{4}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +2/+1.'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'attach to target creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'FirstStrike', validType: 'creature' } satisfies Effect,
        {
          kind: 'custom',
          describe: 'that creature must be blocked this turn if able (no combat/blocking-restriction machinery exists in this model)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],

  activationCost: 'Equip {2}',
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
