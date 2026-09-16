import type { CardDefinition, Effect } from '../../card';

// Real script (rosa_resolute_white_mage.txt): the counter and the lifelink
// grant are two separate `SVar`s (`TrigPutCounter` -> `SubAbility$
// DBPump`), both real `Defined$ Targeted` against the SAME chosen creature
// — modeled as two independent declarative effects that land on the same
// pool[0] target by construction, same convention coral-sword's own
// onEnter trigger documents in full (Forge picks ONE target once at
// 601.2c; this model's `chooseTarget` determinism happens to converge on
// it here since `owner: 'you'` gives both effects the identical pool).
export const rosaResoluteWhiteMage: CardDefinition = {
  name: 'Rosa, Resolute White Mage',
  manaCost: '{3}{W}',
  typeLine: 'Legendary Creature — Human Noble Cleric',

  pt: [2, 3],
  keywords: ['Reach'],

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [
        { kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you' } satisfies Effect,
        // recognizer-exception: grantKeywordTarget-effect-structural — the
        // real printed text says "IT gains lifelink" (an anaphoric
        // reference back to the SAME sentence's own `putCounterTarget`
        // effect above, never the literal words "target creature you
        // control gains") — see this file's own module comment for the
        // real two-separate-effects-one-shared-target shape; a confirmed
        // mismatch, not a bug.
        { kind: 'grantKeywordTarget', keyword: 'Lifelink', validType: 'creature', owner: 'you', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
