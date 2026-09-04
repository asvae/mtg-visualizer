import type { CardDefinition, Effect } from '../../card';

export const tonberry: CardDefinition = {
  name: 'Tonberry',
  manaCost: '{B}',
  typeLine: 'Creature — Salamander Horror',

  pt: [2, 1],

  // "Chef's Knife — During your turn, this creature has first strike and
  // deathtouch." A CONDITIONAL grant ("during your turn"), same reasoning
  // kain-traitorous-dragoon's own "Jump" (During your turn, has flying)
  // keeps as freeform staticAbilities text rather than the unconditional
  // `keywords` array.
  staticAbilities: ["Chef's Knife — During your turn, this creature has first strike and deathtouch."],

  triggers: [
    {
      // "This creature enters tapped with a stun counter on it." Self-tap
      // via the same pool-based `tapTarget` convention shambling-cie-th's
      // own onEnter uses; the counter targets self directly (`putCounter`'s
      // own fixed-self shape needs no pool at all).
      name: 'onEnter',
      effects: [
        { kind: 'tapTarget', validType: 'creature', owner: 'you' } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: 'stun', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
