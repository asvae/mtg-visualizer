import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Real script (monks_fist.txt): Artifact Equipment, Equip {2}, real
// K:Job select (create a 1/1 colorless Hero token, then attach itself to
// it) — same real ETB mechanic dragoon-s-lance/thief-s-knife's own onEnter
// trigger already establishes. "Equipped creature gets +1/+0 and is a
// Monk in addition to its other types" is a continuous static grant, same
// staticAbilities-text-only treatment every other Equipment's own P/T-
// plus-type bonus gets (thief-s-knife's own identical shape, e.g.).
export const monksFist: CardDefinition = {
  name: "Monk's Fist",
  manaCost: '{2}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+0 and is a Monk in addition to its other types.'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'create a 1/1 colorless Hero creature token, then attach this to it',
          run: (ctx: EffectContext, actions: Actions) => {
            const [created] = actions.createToken(ctx.you, TOKENS.c_1_1_hero, 1);
            if (created) actions.equip(ctx.self, created);
          },
        } satisfies Effect,
      ],
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
