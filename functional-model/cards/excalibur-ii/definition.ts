import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (excalibur_ii.txt): "Whenever you gain life, put a charge
// counter on Excalibur II" is a real, directly-modelable trigger — same
// `onLifeGained` -> self `putCounter` shape aerith-gainsborough's own
// trigger already establishes.
//
// "Equipped creature gets +1/+1 for each charge counter on Excalibur II"
// is now real, executable `continuousPTGrants` with `scalePerSelfCounter`
// (2026-09-16, static-ability audit follow-up) — the same real ADD-scaling
// mechanism `continuousPTGrants.scalePerType` already establishes
// (Machinist's Arsenal's own "+2/+2 for each artifact you control"), just
// counting a counter on THIS permanent instead of a type its controller
// controls (see `card.ts`'s own `continuousPTGrants` doc comment).
export const excaliburIi: CardDefinition = {
  name: 'Excalibur II',
  manaCost: '{1}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+1 for each charge counter on Excalibur II.'],
  continuousPTGrants: [{ scalePerSelfCounter: { counterType: 'CHARGE', power: 1, toughness: 1 }, includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      name: 'onLifeGained',
      effects: [{ kind: 'putCounter', target: 'self', counterType: 'CHARGE', amount: 1 } satisfies Effect],
    },
  ],

  // Equip {3} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape every other Equipment in this batch uses.
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
};
