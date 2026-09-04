import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const machinistsArsenal: CardDefinition = {
  name: "Machinist's Arsenal",
  manaCost: '{4}{W}',
  typeLine: 'Artifact — Equipment',

  // Real X = Count$Valid Artifact.YouCtrl/Times.2 — a live artifact-count-
  // dependent P/T grant (layer 7c, but recalculated off board state rather
  // than a fixed delta), same "no live-recalculated CDA machinery" gap
  // gaelicat/adelbert-steiner's own comments already document; kept as
  // real text.
  staticAbilities: ['Equipped creature gets +2/+2 for each artifact you control and is an Artificer in addition to its other types.'],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance's own onEnter trigger; independent of the
  // Machina Equip ability below, so both fit without a one-slot conflict.
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

  // Machina — Equip {4}, a flavor name on the standard Equip ability.
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
