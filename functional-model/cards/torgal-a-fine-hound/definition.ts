import type { CardDefinition, Effect } from '../../card';

// Real script (torgal_a_fine_hound.txt) has TWO abilities:
//  1. `A:AB$ Mana | Cost$ T | Produced$ Any` — a plain mana ability. OUT OF
//     SCOPE per this batch's own deferred-gaps list ("no mana-producing
//     Effect/Action anywhere — deliberate design boundary, no mana pool
//     tracked at all"). Omitted entirely, not built as an `ability`.
//  2. The trigger below, which this model DOES cover.
export const torgalAFineHound: CardDefinition = {
  name: 'Torgal, A Fine Hound',
  manaCost: '{1}{G}',
  typeLine: 'Legendary Creature — Wolf',

  pt: [2, 2],

  triggers: [
    {
      // Real `T:Mode$ SpellCast | ValidCard$ Creature.Human |
      // ActivatorThisTurnCast$ EQ1` — "the first Human creature spell you
      // cast each turn enters with an extra +1/+1 counter per Dog/Wolf you
      // control." The counter lands on THAT creature (the one just cast),
      // not on Torgal itself and not on a player-chosen target — this model
      // has no way to reference "the specific other permanent a trigger's
      // own triggering event named" as a real Card object (only
      // `triggerInput`'s plain data, see EffectContext's own doc comment).
      // `putCounterTarget` is the closest real fit: it already models "put
      // a computed number of counters on a targeted creature you control" —
      // `owner: 'you'` restricts the pool correctly (the entering creature
      // is always yours), and a scenario seeds exactly one qualifying
      // creature so `chooseTarget`'s deterministic first-candidate pick
      // lands on the right one. `amount` is computed live off real board
      // state (Dog/Wolf count), matching the real `SVar:X:Count$Valid
      // Dog.YouCtrl,Wolf.YouCtrl` — no hardcoded/guessed number.
      name: 'onFirstHumanCreatureCast',
      effects: [
        {
          kind: 'putCounterTarget',
          validType: 'creature',
          counterType: '+1/+1',
          owner: 'you',
          amount: (ctx) => ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Dog') || c.hasSubtype('Wolf')).length,
        } satisfies Effect,
      ],
    },
  ],
};
