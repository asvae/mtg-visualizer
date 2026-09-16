import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (lion_heart.txt): Artifact Equipment, Equip {2}. "Equipped
// creature gets +2/+1" — real, mechanical `continuousPTGrants` (2026-09-16,
// static-ability audit follow-up — same already-real query-time machinery
// dragoon-s-lance/paladin-s-arms/thief-s-knife/etc. already use for this
// exact shape).
export const lionHeart: CardDefinition = {
  name: 'Lion Heart',
  manaCost: '{4}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +2/+1.'],

  continuousPTGrants: [{ power: 2, toughness: 1, includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'dealDamageAnyTarget', amount: 2 } satisfies Effect],
    },
  ],

  // Equip {2} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape every other Equipment in this batch uses.
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
