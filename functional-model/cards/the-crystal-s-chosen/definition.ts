import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';
import { putCounter, you } from '../../combinator';

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
      // MIGRATED (2026-09-14) off a `kind:'custom'` closure onto the real
      // `combinator.ts` AST — a plain `Each` over an unfiltered
      // `creaturesInPlay(you)` `Query`, no `Branch`/`Bind` needed (see
      // `combinator.ts`'s own header). `resolveCard` runs top-level
      // `effects` in array order (real state.ts mutation, not a snapshot),
      // so this `each` sees the token-creation effect above's results too
      // — the four new Hero tokens are already on the battlefield and get
      // counted in here — matching the real card's own "then" sequencing.
      //
      // Authored via `combinator.ts`'s own fluent builder layer (2026-09-14
      // follow-up — SAME AST as before, just not a raw nested object
      // literal).
      kind: 'program',
      describe: 'put a +1/+1 counter on each creature you control',
      program: you.creaturesInPlay().each(putCounter('+1/+1', 1)),
    } satisfies Effect,
  ],
};
