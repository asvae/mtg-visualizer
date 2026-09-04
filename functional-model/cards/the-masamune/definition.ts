import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (the_masamune.txt): Legendary Artifact Equipment, Equip {2}.
// Both granted abilities are continuous, attachment-conditional facts, not
// resolvable effects — same staticAbilities-text-only treatment every
// other Equipment's own granted keyword/rule gets (buster-sword/coral-
// sword/genji-glove, e.g.). The Panharmonicon-style "triggers an
// additional time" grant especially has no representable mechanism here
// (no generic "double this creature's own triggered abilities" concept
// exists anywhere in this model) — real text only.
export const theMasamune: CardDefinition = {
  name: 'The Masamune',
  manaCost: '{3}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: [
    'As long as equipped creature is attacking, it has first strike and must be blocked if able.',
    'Equipped creature has "If a creature dying causes a triggered ability of this creature or an emblem you own to trigger, that ability triggers an additional time."',
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
