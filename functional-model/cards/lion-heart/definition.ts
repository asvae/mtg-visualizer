import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (lion_heart.txt): Artifact Equipment, Equip {2}. "Equipped
// creature gets +2/+1" — a continuous static bonus, same staticAbilities-
// text-only treatment every other Equipment's own fixed P/T bonus gets
// (buster-sword/coral-sword/dragoon-s-lance, e.g.) — no `ptFormula` shape
// covers a bonus granted to whatever's equipped (only a CDA on `self`'s
// own P/T).
export const lionHeart: CardDefinition = {
  name: 'Lion Heart',
  manaCost: '{4}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +2/+1.'],

  triggers: [
    {
      name: 'onEnter',
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
