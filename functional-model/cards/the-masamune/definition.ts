import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (the_masamune.txt): Legendary Artifact Equipment, Equip {2}.
// The first-strike/must-be-blocked static has no representable mechanism
// here (no attacker-declaration-time keyword-grant-plus-forced-block
// concept exists) — real text only, same staticAbilities-text-only
// treatment every other Equipment's own unmodeled granted rule gets
// (buster-sword/coral-sword/genji-glove, e.g.). The Panharmonicon-style
// "triggers an additional time" grant IS now real (ENGINE_GAPS.md gap #13,
// closed 2026-09-12) — see `triggerDoubling` below.
export const theMasamune: CardDefinition = {
  name: 'The Masamune',
  manaCost: '{3}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: ['As long as equipped creature is attacking, it has first strike and must be blocked if able.'],

  // Real "Panharmonicon effect" (ENGINE_GAPS.md gap #13) — "Equipped
  // creature has 'If a creature dying causes a triggered ability of this
  // creature or an emblem you own to trigger, that ability triggers an
  // additional time.'" Granted (via Equip) onto whatever creature this is
  // attached to (`equippedSelf`, same real recipient-resolution
  // `continuousKeywordGrants`'s own `equippedBySelf` shape already
  // establishes for an Equipment-broadcast grant), restricted to a
  // `causedBy: 'dying'` firing. The "...or an emblem you own" half is real
  // printed text but genuinely unmodelable — no emblem mechanism exists
  // anywhere in this engine — so it can never actually match; a real,
  // accepted, permanent sub-gap, not silently dropped from the text below.
  triggerDoubling: [{ scope: 'equippedSelf', causedBy: 'dying' }],

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
