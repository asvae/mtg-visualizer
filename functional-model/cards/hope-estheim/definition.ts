import type { CardDefinition, Effect, EffectContext } from '../../card';

export const hopeEstheim: CardDefinition = {
  name: 'Hope Estheim',
  manaCost: '{W}{U}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [2, 2],
  keywords: ['Lifelink'],

  triggers: [
    {
      // "Each opponent mills X cards, where X is the amount of life you
      // gained this turn" — no `mill` Effect kind exists (nor is one
      // needed: real milling IS just library->graveyard `move`, the same
      // convention shinra-reinforcements/summon-titan already use). X
      // itself ("life gained this turn") isn't a value anything in
      // EffectContext computes live (no turn-scoped life-gain tracker
      // anywhere in state.ts) — supplied via `triggerInput`, the same
      // trigger-fixed-variable convention vincent-valentine-galian-beast's
      // own `dyingCreaturePower` already establishes.
      name: 'onEndStep',
      effects: [
        {
          kind: 'move',
          owner: 'opponents',
          from: 'Library',
          to: 'Graveyard',
          qty: (ctx: EffectContext) => (ctx.triggerInput?.lifeGainedThisTurn as number) ?? 0,
        } satisfies Effect,
      ],
    },
  ],
};
