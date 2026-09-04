import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const blackMagesRod: CardDefinition = {
  name: "Black Mage's Rod",
  manaCost: '{1}{B}',
  typeLine: 'Artifact — Equipment',

  // "+1/+0, has 'Whenever you cast a noncreature spell, this creature
  // deals 1 damage to each opponent,' and is a Wizard in addition to its
  // other types" — a static grant of a TRIGGERED ability to whichever
  // creature is equipped, not to this permanent itself (this card has no
  // `AddTrigger$`-equivalent field — `staticAbilities` is real text only,
  // same treatment ninja-s-blades' own granted-trigger comment documents).
  staticAbilities: [
    'Equipped creature gets +1/+0, has "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent," and is a Wizard in addition to its other types.',
  ],

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
