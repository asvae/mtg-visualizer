import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, applyToBound, destroyEach, selectUpTo } from '../../combinator';

export const coliseumBehemoth: CardDefinition = {
  name: 'Coliseum Behemoth',
  manaCost: '{5}{G}{G}',
  typeLine: 'Creature — Beast',

  pt: [7, 7],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: 'Destroy target artifact or enchantment.',
              effects: [
                {
                  // `destroy`'s own `validType` union (`'permanent' |
                  // 'creature' | 'land'`) has no "artifact or enchantment"
                  // option — 'permanent' would incorrectly widen the legal
                  // target pool to creatures/lands too. Migrated 2026-09-16
                  // off a `kind:'custom'` closure onto the combinator DSL's
                  // `cardType` Filter predicate (2026-09-16, built for
                  // Ultima/fin-38's own "artifacts and creatures" — an
                  // OR-matched array of `CardTypeWord`s covers "artifact or
                  // enchantment" identically) + `destroy` EachAction, picking
                  // ONE target via `selectUpTo(..., 1, ...)` (same real
                  // `actions.chooseTarget` pool-exhaustion loop the original
                  // closure used) then `applyToBound` to destroy just that
                  // bound item. Same real behavior, now recognizer-readable
                  // data instead of an opaque closure.
                  kind: 'program',
                  describe: 'destroy target artifact or enchantment',
                  program: selectUpTo(anyPlayer.permanentsInPlay().filter('cardType', ['artifact', 'enchantment']), 1, 'target', [applyToBound('target', 0, destroyEach())]),
                } satisfies Effect,
              ],
            },
            { describe: 'Draw a card.', effects: [{ kind: 'drawCard' } satisfies Effect] },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
