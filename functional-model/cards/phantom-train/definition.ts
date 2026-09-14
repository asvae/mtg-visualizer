import type { CardDefinition, Effect } from '../../card';

export const phantomTrain: CardDefinition = {
  name: 'Phantom Train',
  manaCost: '{3}{B}',
  typeLine: 'Artifact — Vehicle',

  keywords: ['Trample'],

  // The activation cost here is "sacrifice another artifact or creature,"
  // not mana — activationCost is just a descriptive label, so this fits
  // without a new field, but paying that cost is modeled as the FIRST
  // effect below rather than left invisible, purely so the trace shows it
  // happening (a real engine pays costs before effects resolve, not as
  // effect #1 of the resolution — a known simplification, flagged here
  // rather than silently assumed correct).
  activationCost: 'Sacrifice another artifact or creature',
  // recognizer-exception: putCounterSelf-effect-structural — real text reads
  // "Put a +1/+1 counter on this Vehicle," self-referenced via its own
  // printed SUBTYPE ("Vehicle"), not this card's own name nor any of that
  // recognizer's vetted permanent-supertype words ("this artifact," from
  // this card's own typeLine "Artifact — Vehicle," is the only alternative
  // it tries — the real text doesn't say that). See that recognizer's own
  // module doc comment for the full reasoning on why this stays declined
  // rather than a new, unvetted "this <printed subtype>" template invented
  // for one card.
  effects: [
    { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true } satisfies Effect,
    { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
    { kind: 'animate', target: 'self', types: ['Artifact', 'Creature', 'Spirit'] } satisfies Effect,
  ],
};
