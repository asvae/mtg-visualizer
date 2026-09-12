import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const blackMagesRod: CardDefinition = {
  name: "Black Mage's Rod",
  manaCost: '{1}{B}',
  typeLine: 'Artifact — Equipment',

  // The +1/+0 P/T bonus and "is a Wizard" type grant are now real,
  // executable machinery (ENGINE_GAPS.md gap #14, fully closed 2026-09-12),
  // same generalization dragoon-s-lance's/paladin-s-arms's/white-mage-s-
  // staff's own migrations established. The granted "Whenever you cast a
  // noncreature spell, this creature deals 1 damage to each opponent"
  // triggered ability is a genuinely DIFFERENT, still-open gap class (no
  // vocabulary/pipeline anywhere in this model grants a WHOLE NEW triggered
  // ability — its own trigger condition PLUS its own effect — to another
  // permanent; `continuousKeywordGrants`/`continuousPTGrants`/
  // `continuousTypeGrants` only ever broadcast a keyword/P&T delta/subtype,
  // never a fresh condition+effect pair) — stays real-but-inert, unaffected
  // by this pass (see synergy.json's own `damage` fact,
  // `isBlackMagesRodGrantedAbilityFact` in verify-synergy.mjs; same
  // treatment White Mage's Staff's own granted-lifegain-on-attack got —
  // checked ENGINE_GAPS.md fresh, nothing has closed this gap class since).
  staticAbilities: [
    'Equipped creature gets +1/+0, has "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent," and is a Wizard in addition to its other types.',
  ],

  continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Wizard'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance/paladin-s-arms/machinist-s-arsenal's own
  // onEnter trigger.
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
