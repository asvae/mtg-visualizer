import type { CardDefinition, Effect } from '../../card';

export const tonberry: CardDefinition = {
  name: 'Tonberry',
  manaCost: '{B}',
  typeLine: 'Creature — Salamander Horror',

  pt: [2, 1],

  // "Chef's Knife — During your turn, this creature has first strike and
  // deathtouch." A CONDITIONAL grant ("during your turn"), same reasoning
  // kain-traitorous-dragoon's own "Jump" (During your turn, has flying)
  // keeps text-only rather than the unconditional `keywords` array — now
  // real, executable `continuousKeywordGrants` alongside it (2026-09-16,
  // static-ability audit follow-up — same self-only, no-`subtype` shape
  // freya-crescent's/kain-traitorous-dragoon's own identical grants use,
  // here a real 2-keyword list).
  staticAbilities: ["Chef's Knife — During your turn, this creature has first strike and deathtouch."],
  continuousKeywordGrants: [{ keywords: ['FirstStrike', 'Deathtouch'], includeSelf: true, onlyDuringYourTurn: true }],

  triggers: [
    {
      // "This creature enters tapped with a stun counter on it." Self-tap
      // via the same pool-based `tapTarget` convention shambling-cie-th's
      // own onEnter uses; the counter targets self directly (`putCounter`'s
      // own fixed-self shape needs no pool at all).
      //
      // recognizer-exception: putCounterSelf-effect-structural — real text
      // never uses the verb "put" at all for this counter (it's an
      // ETB-modifier idiom, "enters tapped with a stun counter on it"), same
      // real divergence zack-fair's/relentless-x-atm092's own markers
      // document. See that recognizer's own module doc comment.
      //
      // recognizer-exception: entersBattlefield-self-trigger-structural —
      // same real CR 614.12 "enters tapped" idiom as above: no "When/
      // Whenever this creature enters" clause exists in the real printed
      // text at all, so this recognizer correctly declines rather than
      // asserting a false sink fact.
      name: 'onEnter',
      on: 'enter',
      effects: [
        { kind: 'tapTarget', validType: 'creature', owner: 'you' } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: 'stun', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
