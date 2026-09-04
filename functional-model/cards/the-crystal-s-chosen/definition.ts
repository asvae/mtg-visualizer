import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const theCrystalsChosen: CardDefinition = {
  name: "The Crystal's Chosen",
  manaCost: '{5}{W}{W}',
  typeLine: 'Sorcery',

  effects: [
    { kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 4 } satisfies Effect,
    {
      // "Then put a +1/+1 counter on each creature you control" — a
      // board-wide broadcast, not a chosen target, so `putCounter` (always
      // `self`-targeted) and `putCounterTarget` (a player CHOOSES up to
      // qty) both miss this shape; no `putCounterAll` kind exists yet.
      // Reaches for `custom` narrowly, same as pumpAll's own
      // creatures-you-control loop, but for counters. Runs AFTER the
      // tokens above are actually created (real state.ts mutation, not a
      // snapshot), so the four new Hero tokens are already on the
      // battlefield and get counted in here too — matches the real card's
      // own "then" sequencing.
      kind: 'custom',
      describe: 'put a +1/+1 counter on each creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        for (const creature of ctx.you.getCreaturesInPlay()) actions.putCounter(creature, '+1/+1', 1);
      },
    } satisfies Effect,
  ],
};
