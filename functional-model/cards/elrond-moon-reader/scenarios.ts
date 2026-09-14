import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onActivateCreatureAbility' },
  {
    // Real `ActivationLimit$ 1` (`res/cardsfolder/e/elrond_moon_reader.txt`,
    // `definition.ts`'s own `activationLimit: 1`) — a SECOND same-turn
    // firing of this named trigger draws no second card. Fired twice via
    // `sequence` within one scenario (this model has no automatic "an
    // ability of a creature was activated" detection, so both firings are
    // manual, same as the baseline scenario above) — the trace shows two
    // `trigger` brackets but only ONE real `drawCard`, proving the cap is
    // genuinely enforced (`triggers.ts`'s `fireTrigger`), not just declared.
    result: 'draws a card the first time you activate a creature ability this turn; a second creature-ability activation the same turn triggers no second draw (ActivationLimit 1)',
    sequence: ['onActivateCreatureAbility', 'onActivateCreatureAbility'],
  },
  {
    result: 'exiles up to two other nonland permanents you control now, then returns them to the battlefield only once the game reaches the end step (not immediately)',
    you: { creaturesCount: 2, nontokenCreaturesCount: 2 },
    advanceToPhase: 'EndOfTurn',
  },
  { result: 'no other nonland permanents you control — exiles/returns nothing', you: { creaturesCount: 0 } },
];
