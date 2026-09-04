import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const astrologiansPlanisphere: CardDefinition = {
  name: "Astrologian's Planisphere",
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature is a Wizard in addition to its other types.'],

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
    // "has 'Whenever you cast a noncreature spell and whenever you draw
    // your third card each turn, put a +1/+1 counter on this creature.'" —
    // a granted ability, modeled as if it were this Equipment's own two
    // independent triggers (same simplification Ninja's Blades' own
    // onEquippedDealsDamage comment documents: the real source is whichever
    // creature is equipped, not this permanent). Both real trigger
    // conditions resolve to the exact same declarative payoff, so each gets
    // its own named trigger rather than folding into one.
    {
      name: 'onEquippedCastsNoncreatureSpell',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      name: 'onEquippedDrawsThirdCardThisTurn',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
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
