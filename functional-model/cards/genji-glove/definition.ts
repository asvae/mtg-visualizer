import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (genji_glove.txt): Artifact Equipment, Equip {3}.
// "Equipped creature has double strike" — a continuous grant tied to
// attachment, not a resolvable effect (same staticAbilities-text-only
// treatment every other Equipment's own granted keyword gets — buster-
// sword/coral-sword/dragoon-s-lance, e.g. — `grantKeywordTarget` is for a
// ONE-SHOT resolution granting a keyword, not an always-on attachment-
// conditional grant).
//
// "Whenever equipped creature attacks, if it's the first combat phase of
// the turn, untap it. After this phase, there is an additional combat
// phase." Two real, separate consequences: untapping the equipped
// creature IS modeled (`ctx.self.getAttachedTo()` — real `Card.
// getAttachedTo()`, interfaces.ts — finds exactly the equipped creature,
// then `actions.untap` directly, since `untapTarget`'s own pool-based
// targeting has no "the specific creature this Equipment is attached to"
// filter). "There is an additional combat phase" has no Effect kind
// anywhere in this model (no turn/phase-structure mutation exists here —
// same real gap balthier-and-fran's own identical "additional combat
// phase" clause already documents), kept as an honest no-op `custom` with
// the real text carried via `describe`.
export const genjiGlove: CardDefinition = {
  name: 'Genji Glove',
  manaCost: '{5}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature has double strike.'],

  triggers: [
    {
      name: 'onEquippedAttacksFirstCombat',
      effects: [
        {
          kind: 'custom',
          describe: "if it's the first combat phase of the turn, untap equipped creature",
          run: (ctx: EffectContext, actions: Actions) => {
            const equipped = ctx.self.getAttachedTo();
            if (equipped) actions.untap(equipped);
          },
        } satisfies Effect,
        {
          kind: 'custom',
          describe: 'after this phase, there is an additional combat phase (no turn/phase-structure Effect shape exists here)',
          run: () => {},
        } satisfies Effect,
      ],
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
