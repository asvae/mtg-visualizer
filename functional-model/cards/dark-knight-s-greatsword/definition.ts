import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const darkKnightsGreatsword: CardDefinition = {
  name: "Dark Knight's Greatsword",
  manaCost: '{2}{B}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +3/+0 and is a Knight in addition to its other types.'],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance/paladin-s-arms/machinist-s-arsenal/black-
  // mage-s-rod's own onEnter trigger.
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

  // Chaosbringer — Equip—Pay 3 life. Activate only once each turn. A
  // non-mana cost (real `K:Equip:PayLife<3>`), same "cost text on
  // activationCost" convention sidequest-catch-a-fish-cooking-campsite's
  // own sacrifice-cost activated ability uses. The life payment is modeled
  // as the FIRST effect below so the trace shows it happening, same
  // convention ahriman/phantom-train's own cost-effects use — "activate
  // only once each turn" has no per-turn-activation-limit tracking
  // anywhere in this model (no turn-structure state at all — same boundary
  // this batch's other turn-based restrictions hit), kept as real text via
  // `activationCost` only.
  activationCost: 'Equip—Pay 3 life (activate only once each turn)',
  effects: [
    { kind: 'loseLife', owner: 'you', amount: 3 } satisfies Effect,
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
