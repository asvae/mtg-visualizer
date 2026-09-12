import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const whiteMagesStaff: CardDefinition = {
  name: "White Mage's Staff",
  manaCost: '{1}{W}',
  typeLine: 'Artifact — Equipment',

  // The +1/+1 P/T bonus and "is a Cleric" type grant are now real,
  // executable machinery (ENGINE_GAPS.md gap #14, fully closed 2026-09-12),
  // same generalization dragoon-s-lance's/paladin-s-arms's own migrations
  // established. The granted "Whenever this creature attacks, you gain 1
  // life" triggered ability is a genuinely DIFFERENT, still-open gap class
  // (no vocabulary/pipeline anywhere in this model grants a WHOLE NEW
  // triggered ability — its own trigger condition PLUS its own effect — to
  // another permanent; `continuousKeywordGrants`/`continuousPTGrants`/
  // `continuousTypeGrants` only ever broadcast a keyword/P&T delta/subtype,
  // never a fresh condition+effect pair) — stays real-but-inert, unaffected
  // by this pass (see synergy.json's own `lifegain` fact,
  // `isWhiteMagesStaffGrantedAbilityFact` in verify-synergy.mjs).
  staticAbilities: ['Equipped creature gets +1/+1, has "Whenever this creature attacks, you gain 1 life," and is a Cleric in addition to its other types.'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Cleric'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, then attach
  // this to it) as dragoon-s-lance/paladin-s-arms/machinist-s-arsenal's own
  // onEnter trigger; independent of the Equip ability below.
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

  // Equip {3} — same attach-to-a-chosen-creature shape dragoon-s-lance/
  // paladin-s-arms/machinist-s-arsenal/ninja-s-blades all use for their own
  // Equip ability (no declarative `equip` Effect kind exists — `custom`
  // calling the real `actions.equip` is the established shape).
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
