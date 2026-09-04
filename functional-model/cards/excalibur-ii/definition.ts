import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (excalibur_ii.txt): "Whenever you gain life, put a charge
// counter on Excalibur II" is a real, directly-modelable trigger — same
// `onLifeGained` -> self `putCounter` shape aerith-gainsborough's own
// trigger already establishes.
//
// "Equipped creature gets +1/+1 for each charge counter on Excalibur II"
// is a real layer-7 continuous effect on the EQUIPPED creature, driven by
// a counter count on THIS permanent, not the equipped creature's own P/T
// or `self`'s own — `ptFormula` only covers a CDA on `self`'s own P/T
// (state.ts's own `effectivePT`), never a bonus granted to whatever's
// equipped (same gap aettir-and-priwen's own life-total-driven grant
// flags). Kept as real text only, same staticAbilities-text treatment
// every other Equipment's own P/T bonus gets in this batch.
export const excaliburIi: CardDefinition = {
  name: 'Excalibur II',
  manaCost: '{1}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+1 for each charge counter on Excalibur II.'],

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
