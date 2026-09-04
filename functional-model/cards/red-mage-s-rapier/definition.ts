import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const redMagesRapier: CardDefinition = {
  name: "Red Mage's Rapier",
  manaCost: '{1}{R}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature is a Wizard in addition to its other types.'],

  // Job select — same real ETB mechanic (create a 1/1 colorless Hero token,
  // then attach this to it) as dragoon-s-lance/thief-s-knife/machinist-s-
  // arsenal/paladin-s-arms' own onEnter trigger.
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
    {
      // "Equipped creature has 'Whenever you cast a noncreature spell, this
      // creature gets +2/+0 until end of turn'" — a real ability GRANTED to
      // the equipped creature, modeled as if it were Red Mage's Rapier's
      // own trigger (same simplification thief-s-knife/ninja-s-blades' own
      // granted-trigger comments already document). Unlike those two cards,
      // this granted effect needs to modify "this creature" (the equipped
      // one), not the Equipment itself — but no attachment-query getter
      // exists anywhere in this model (see light-of-judgment's own gap note
      // for the same missing capability), so the equipped creature is
      // approximated as the first creature you control (correct whenever
      // there's exactly one, the common case after Job select just made
      // one) via the same always-first-candidate `chooseTarget` bias every
      // other targeted effect here already accepts.
      name: 'onEquippedCastsNoncreatureSpell',
      effects: [
        {
          kind: 'custom',
          describe: 'this creature gets +2/+0 until end of turn',
          run: (ctx: EffectContext, actions: Actions) => {
            const creatures = ctx.you.getCreaturesInPlay();
            if (creatures.length === 0) return;
            const equipped = actions.chooseTarget(creatures);
            actions.pump(equipped, 2, 0);
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
