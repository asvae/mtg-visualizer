import type { CardDefinition, Effect } from '../../card';

export const fateOfTheSunCryst: CardDefinition = {
  name: 'Fate of the Sun-Cryst',
  manaCost: '{4}{W}',
  typeLine: 'Instant',

  // Real Forge S:Mode$ ReduceCost — a genuine dynamic mana-cost reduction
  // keyed on the chosen target's tapped state at cast time. No cost-
  // reduction machinery exists anywhere in this model (`manaCost` is a
  // fixed printed string, never recomputed for a specific cast) — same
  // treatment every other continuous/cost-affecting static ability gets:
  // real text, not an executed effect.
  staticAbilities: ['This spell costs {2} less to cast if it targets a tapped creature.'],

  effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1 } satisfies Effect],
};
