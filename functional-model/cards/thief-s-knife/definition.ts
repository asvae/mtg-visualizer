import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const thiefsKnife: CardDefinition = {
  name: "Thief's Knife",
  manaCost: '{2}{U}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +1/+1, has '...', and is a Rogue in addition to
  // its other types" — real Forge citation (thiefs_knife.txt, ../mtg-forge):
  // ONE static ability, `S:Mode$ Continuous | Affected$ Creature.EquippedBy |
  // AddPower$ 1 | AddToughness$ 1 | AddType$ Rogue | AddTrigger$ TrigDmg |
  // ...` — the SAME real, query-time recipient-resolution mechanism
  // dragoon-s-lance/paladin-s-arms/crystal-fragments-summon-alexander/
  // white-mage-s-staff/sage-s-nouliths/machinist-s-arsenal/astrologian-s-
  // planisphere already establish (ENGINE_GAPS.md gap #14's own follow-up,
  // closed 2026-09-12), modeled as two independent grant fields here since
  // state.ts's own layer split (P/T vs. type) already keeps them in separate
  // read paths (`effectivePT`/`effectiveSubtypes`) regardless of how Forge's
  // own single ability groups them. The `AddTrigger$ TrigDmg` third clause
  // ("has 'whenever this creature deals combat damage to a player, draw a
  // card'") is a granted NEW triggered ability, not a static broadcast —
  // modeled the same `onEquippedDealsDamage`-as-self simplification buster-
  // sword/genji-glove already establish (the real source is whichever
  // creature is equipped, not this permanent), via the trigger below.
  staticAbilities: ['Equipped creature gets +1/+1, has "Whenever this creature deals combat damage to a player, draw a card," and is a Rogue in addition to its other types.'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Rogue'], includeSelf: false, equippedBySelf: true }],

  triggers: [
    // Job select — same real ETB mechanic as sage-s-nouliths/dragoon-s-
    // lance/machinist-s-arsenal/paladin-s-arms' own onEnter trigger.
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
    // The granted "whenever this creature deals combat damage to a player,
    // draw a card" — granted TO the equipped creature by Thief's Knife's
    // own static ability, modeled as if it were Thief's Knife's own
    // trigger, same simplification ninja-s-blades' own
    // `onEquippedDealsDamage` documents. Unlike Ninja's Blades' own
    // granted trigger, this one is a plain draw — no `custom` needed.
    {
      name: 'onEquippedDealsDamage',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect],
    },
  ],

  // Equip {4} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape as dragoon-s-lance/machinist-s-arsenal/paladin-s-arms.
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
