import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const paladinsArms: CardDefinition = {
  name: "Paladin's Arms",
  manaCost: '{2}{W}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +2/+1 ... and is a Knight in addition to its
  // other types" — same real, honest-but-structurally-inert gap dragoon-
  // s-lance's/machinist-s-arsenal's own identical clause shape already
  // documents: no continuous-effect/layer-7c pipeline anywhere in this
  // model applies a static P/T bonus or a dynamic type grant to ANOTHER
  // permanent (card.ts's own `animate` dispatch is self-only). Real Facts
  // still exist for both halves (see synergy.json).
  staticAbilities: ['Equipped creature gets +2/+1 and is a Knight in addition to its other types.'],

  // "...has ward {1}..." — same real clause, but a KEYWORD grant rather
  // than a P/T/type grant, so it plugs directly into already-built,
  // executable machinery: `continuousKeywordGrants`'s `equippedBySelf`
  // mode (dragoon-s-lance's own "During your turn, equipped creature has
  // flying" — same real, live `RealCard.attachedToId` check, `state.ts`'s
  // own `effectiveKeywords`). Genuinely UNCONDITIONAL here (no "during
  // your turn" qualifier anywhere in this card's real oracle text, unlike
  // Dragoon's Lance's Flying), so `onlyDuringYourTurn` is correctly
  // omitted — same unconditional shape Ardyn, the Usurper's own Demons
  // grant already establishes for a non-turn-gated grant.
  continuousKeywordGrants: [{ keywords: ['Ward'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance's/machinist-s-arsenal's own onEnter trigger.
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

  // Lightbringer and Hero's Shield — Equip {4}, a flavor name on the
  // standard Equip ability, same attach-to-a-chosen-creature shape as
  // dragoon-s-lance's/machinist-s-arsenal's own Equip {4}.
  activationCost: '{4}',
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
