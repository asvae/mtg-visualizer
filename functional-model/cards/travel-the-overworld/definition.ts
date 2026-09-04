import type { CardDefinition, Effect } from '../../card';

export const travelTheOverworld: CardDefinition = {
  name: 'Travel the Overworld',
  manaCost: '{5}{U}{U}',
  typeLine: 'Sorcery',

  // Real Forge K:Affinity:Town — a genuine dynamic mana-cost reduction
  // (costs {1} less per Town you control). No cost-reduction machinery
  // exists anywhere in this model (`manaCost` is a fixed printed string,
  // never recomputed for a specific cast) — same treatment fate-of-the-
  // sun-cryst's own ReduceCost static already gets: real text, not an
  // executed effect.
  staticAbilities: ['Affinity for Towns (This spell costs {1} less to cast for each Town you control.)'],

  effects: [{ kind: 'drawCard', amount: 4 } satisfies Effect],
};
