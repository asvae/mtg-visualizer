import type { CardDefinition, Effect } from '../../card';

export const theEarthCrystal: CardDefinition = {
  name: 'The Earth Crystal',
  manaCost: '{2}{G}{G}',
  typeLine: 'Legendary Artifact',

  staticAbilities: [
    // Real cost-reduction static — no cost-reduction machinery exists
    // anywhere in this model, same treatment travel-the-overworld's own
    // Affinity gets.
    'Green spells you cast cost {1} less to cast.',
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
      kind: 'putCounterTarget',
      validType: 'creature',
      owner: 'you',
      counterType: '+1/+1',
      amount: 1,
      qty: 2,
    } satisfies Effect,
  ],
};
