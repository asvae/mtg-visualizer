import type { CardDefinition, Effect } from '../../card';

export const valkyrieAerialUnit: CardDefinition = {
  name: 'Valkyrie Aerial Unit',
  manaCost: '{5}{U}{U}',
  typeLine: 'Artifact Creature — Construct',

  pt: [5, 4],
  keywords: ['Flying'],

  // Real Forge K:Affinity:Artifact — now real, executable
  // `costReduction.perControlled` (2026-09-16, static-ability audit
  // follow-up). Unlike Bartz and Boko's/Cantankerous Keepers' own
  // subtype-counted Affinity, this counts a card TYPE (Artifact), not a
  // creature subtype — real Forge's own `Affinity` keyword
  // (`Affinity.java`) resolves both the same way; `engine.ts`'s own
  // `effectiveCastCost` was widened to check `c.types` alongside
  // `c.subtypes` for exactly this case.
  staticAbilities: ['Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)'],
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Artifact' } },

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'surveil', qty: 2 } satisfies Effect],
    },
  ],
};
