import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const astrologiansPlanisphere: CardDefinition = {
  name: "Astrologian's Planisphere",
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Equipment',

  // Full real oracle text, including the granted ability clause below —
  // real printed text, kept verbatim even though the granted-ability half
  // has no engine modeling (see the `triggers` comment below for why).
  staticAbilities: [
    'Equipped creature is a Wizard in addition to its other types and has "Whenever you cast a noncreature spell and whenever you draw your third card each turn, put a +1/+1 counter on this creature."',
  ],

  // "is a Wizard in addition to its other types" — the type-grant half is
  // now real, executable machinery (ENGINE_GAPS.md gap #14, fully closed
  // 2026-09-12), same generalization dragoon-s-lance's/machinist-s-arsenal's/
  // paladin-s-arms's/white-mage-s-staff's/sage-s-nouliths's own migrations
  // established. The granted "put a +1/+1 counter..." ability below is
  // UNAFFECTED — a genuinely different, still-open gap class (granting a
  // whole new triggered ability, not a static type broadcast).
  continuousTypeGrants: [{ types: ['Wizard'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, then attach
  // this to it) as dragoon-s-lance/paladin-s-arms/machinist-s-arsenal/
  // white-mage-s-staff's own onEnter trigger; independent of the Equip
  // ability below.
  //
  // The granted "has 'Whenever you cast a noncreature spell and whenever
  // you draw your third card each turn, put a +1/+1 counter on this
  // creature'" clause is deliberately NOT modeled as a trigger here — same
  // real gap White Mage's Staff's own definition.ts documents for its
  // "Whenever this creature attacks, you gain 1 life" grant
  // (scripts/verify-synergy.mjs's own `isWhiteMagesStaffGrantedAbilityFact`
  // doc comment has the full reasoning): no `Effect` kind or `Actions`
  // member anywhere in this model grants a WHOLE NEW triggered ability
  // (its own trigger condition plus its own effect) to another permanent —
  // `continuousKeywordGrants`'s `equippedBySelf` mode only ever broadcasts
  // a KEYWORD, never a fresh condition+effect pair. An earlier version of
  // this file modeled the grant as if it were this Equipment's OWN trigger
  // (`onEquippedCastsNoncreatureSpell`/`onEquippedDrawsThirdCardThisTurn`,
  // putting the counter on `target: 'self'`) — that's a real, documented
  // MISMODEL, not just an inert simplification: the real ability puts the
  // counter on the EQUIPPED CREATURE ("this creature" in the granted text
  // refers to whatever is wearing the Equipment), not on the Equipment
  // permanent itself, and nothing in this model can actually resolve
  // "whichever creature is currently equipped" as a live trigger source.
  // Removed rather than kept as a misleading-but-passing fabrication; the
  // real fact (`synergy.json`'s own `event:'putCounter'`,
  // `target:{equippedBySelf:true}`) documents the granted ability honestly
  // and is exempted from trace evidence by name/shape in verify-synergy.mjs
  // (`isEquipGrantedPutCounterFact`), same treatment as the lifegain fact.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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

  // Diana — Equip {2}, a flavor name on the standard Equip ability, same
  // attach-to-a-chosen-creature shape dragoon-s-lance/paladin-s-arms/
  // machinist-s-arsenal/ninja-s-blades already use.
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
