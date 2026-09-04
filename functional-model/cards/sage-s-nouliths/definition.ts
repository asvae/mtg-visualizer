import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const sagesNouliths: CardDefinition = {
  name: "Sage's Nouliths",
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +1/+0 and is a Cleric in addition to its other types.'],

  // Job select — same real ETB mechanic (create a 1/1 Hero token, attach
  // this to it) as dragoon-s-lance/machinist-s-arsenal/paladin-s-arms'
  // own onEnter trigger.
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
    // The granted "whenever this creature attacks, untap target attacking
    // creature" — granted TO the equipped creature by Sage's Nouliths' own
    // static ability, modeled here as if it were Sage's Nouliths' own
    // trigger, same simplification ninja-s-blades' own
    // `onEquippedDealsDamage` already documents (the real source is
    // whichever creature is equipped, not this permanent). No declarative
    // "untap a chosen target" Effect kind exists (only `tapTarget`), so
    // `custom` calling the real `untap` action directly.
    {
      name: 'onEquippedAttacks',
      effects: [
        {
          kind: 'custom',
          describe: 'untap target attacking creature',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
            const target = actions.chooseTarget(pool);
            if (target) actions.untap(target);
          },
        } satisfies Effect,
      ],
    },
  ],

  // Hagneia — Equip {3}, a flavor name on the standard Equip ability.
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
