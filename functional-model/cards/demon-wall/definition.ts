import type { CardDefinition, Effect } from '../../card';

export const demonWall: CardDefinition = {
  name: 'Demon Wall',
  manaCost: '{1}{B}',
  typeLine: 'Artifact Creature — Demon Wall',

  pt: [3, 3],
  keywords: ['Defender', 'Menace'],

  // "As long as this creature has a counter on it, it can attack as though
  // it didn't have defender" — a real conditional static ability keyed off
  // this permanent's own counter count, but this model has no attack/combat
  // system at all (no attacking-legality check anywhere `Defender` could be
  // read back from) — plain descriptive text, not a resolvable step, same
  // as every other genuinely-continuous rule that isn't a recognized
  // `keywords` entry or `ptFormula`.
  staticAbilities: ['As long as this creature has a counter on it, it can attack as though it didn\'t have defender.'],

  activationCost: '{5}{B}',
  effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 2 } satisfies Effect],
};
