import type { CardDefinition, Effect } from '../../card';

export const theEarthCrystal: CardDefinition = {
  name: 'The Earth Crystal',
  manaCost: '{2}{G}{G}',
  typeLine: 'Legendary Artifact',

  // "Green spells you cast cost {1} less to cast." — real, structured
  // `SpellCostReductionGrant` machinery (The Water Crystal's/The Wind
  // Crystal's own precedent) already exists for this exact shape; an
  // earlier version of this card left it as inert freeform text instead
  // ("no cost-reduction machinery exists anywhere in this model" — stale,
  // predating that field's own addition), fixed for real below.
  spellCostReductionGrants: [{ amount: 1, colors: ['G'] }],

  staticAbilities: [
    // Real REPLACEMENT effect doubling +1/+1 counters put on your
    // creatures — no replacement-effect machinery exists anywhere in this
    // model (state.ts's own header rules this out, same treatment
    // the-water-crystal's own mill-replacement gets). Kept as real text,
    // NOT applied to this card's own activated ability below (which
    // distributes the printed, undoubled amount) — same "not mechanically
    // enforced, even against its own other ability" precedent the-water-
    // crystal's own mill effect sets.
    'If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead.',
  ],

  activationCost: '{4}{G}{G}, {T}',
  effects: [
    {
      // Real `DividedAsYouChoose$2` — "distribute two +1/+1 counters among
      // one or two target creatures." No Effect kind models splitting a
      // fixed total across a player-chosen number of targets (`putCounterTarget`
      // always applies the SAME `amount` to every chosen target, not a
      // shared pool divided up) — `qty: 2`/`amount: 1` models the real
      // "one counter on each of two different creatures" resolution
      // (a legal, common real choice), but not the alternate "both
      // counters on a single creature" branch the real card also allows.
      // recognizer-exception: putCounterTarget-effect-structural — real
      // printed text reads "Distribute two +1/+1 counters among one or two
      // target creatures you control," never "put ... counter on target"
      // (the built clause this recognizer looks for) — a confirmed model
      // approximation (this comment), not a recognizer bug.
      kind: 'putCounterTarget',
      validType: 'creature',
      owner: 'you',
      counterType: '+1/+1',
      amount: 1,
      qty: 2,
    } satisfies Effect,
  ],
};
