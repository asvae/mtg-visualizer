import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const dragoonsLance: CardDefinition = {
  name: "Dragoon's Lance",
  manaCost: '{1}{W}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +1/+0 and is a Knight in addition to its other
  // types" / "During your turn, equipped creature has flying" — 2026-09-12
  // real split: the FLYING clause is now real, executable machinery
  // (`continuousKeywordGrants`'s new `equippedBySelf` mode, ENGINE_GAPS.md
  // gap #14 generalized — ask that reused the exact turn-conditional
  // mechanism just built for Dion/Ardyn, with a different recipient
  // predicate: whatever creature THIS Equipment is currently attached to,
  // via the real, live `RealCard.attachedToId` link, not a subtype match).
  // The +1/+0 PUMP and "is a Knight" TYPE-grant clauses stay real text
  // only, same real structural gaps `crystal-fragments-summon-alexander`'s
  // own equivalent pump clause already established (no continuous-effect/
  // layer-7c pipeline anywhere in this model for a static bonus flowing
  // from an Equipment to whatever it's attached to) — checked `card.ts`'s
  // own `animate` dispatch (only ever self-targeted, `actions.animate
  // (ctx.self, ...)`) and `layers.ts`'s own header for a dynamic TYPE
  // grant to ANOTHER permanent: none exists (only Phantom Train's own
  // self-animate). A real Fact still exists for both (see synergy.json),
  // honest-but-structurally-inert, not fabricated trace evidence.
  staticAbilities: ['Equipped creature gets +1/+0 and is a Knight in addition to its other types.'],

  continuousKeywordGrants: [{ keywords: ['Flying'], includeSelf: false, equippedBySelf: true, onlyDuringYourTurn: true }],

  // Job select — "When this Equipment enters, create a 1/1 colorless Hero
  // creature token, then attach this to it." A real ETB trigger (Forge's
  // own K:Job select keyword expands to exactly this), not the card's
  // Equip ability below — the two are independent abilities, so both fit
  // without the one-activated-ability-slot conflict crystal-fragments-
  // summon-alexander's own comment documents.
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

  // Gae Bolg — Equip {4}, a flavor name on the standard Equip ability, not
  // a second card-specific mechanic. Same attach-to-a-chosen-creature shape
  // as ninja-s-blades' own Equip {2}.
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
