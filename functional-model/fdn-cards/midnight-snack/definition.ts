import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens';

export const midnightSnack: CardDefinition = {
  name: 'Midnight Snack',
  manaCost: '{2}{B}',
  typeLine: 'Enchantment',

  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'Raid — At the beginning of your end step, if you attacked this turn, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
      demand: 'Same Raid conditional-trigger-gating gap as Crypt Feaster/Gutless Plunderer — no field lets a trigger\'s firing (here `on:\'endStep\'`) be gated on "you attacked this turn"; the token-creation effect below currently fires every end step unconditionally instead of only on a Raid turn.',
    },
  ],

  triggers: [
    {
      name: 'onEndStep',
      on: 'endStep',
      effects: [
        {
          kind: 'createToken',
          token: TOKENS.c_a_food_sac,
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],

  // "Target opponent loses X life, where X is the amount of life you
  // gained this turn." X isn't a value anything in `EffectContext`
  // computes live (no turn-scoped life-gain tracker anywhere in
  // state.ts) — supplied via `triggerInput`, the same real convention
  // hope-estheim's own "amount of life you gained this turn" already
  // establishes. "Target opponent" approximates to every opponent
  // (`owner: 'opponents'`) — same established single-chosen-opponent
  // simplification al-bhed-salvagers/combat-tutorial already document.
  activationCost: '{2}{B}, sacrifice this enchantment',
  effects: [
    {
      kind: 'loseLife',
      owner: 'opponents',
      amount: (ctx) => (ctx.triggerInput?.lifeGainedThisTurn as number) ?? 0,
    } satisfies Effect,
  ],
};
