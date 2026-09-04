import type { CardDefinition, Effect } from '../../card';

export const valkyrieAerialUnit: CardDefinition = {
  name: 'Valkyrie Aerial Unit',
  manaCost: '{5}{U}{U}',
  typeLine: 'Artifact Creature — Construct',

  pt: [5, 4],
  keywords: ['Flying'],

  // Real Forge K:Affinity:Artifact — same "no cost-reduction machinery"
  // boundary travel-the-overworld's own Affinity:Town gets: real text,
  // not an executed effect.
  staticAbilities: ['Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'surveil', qty: 2 } satisfies Effect],
    },
  ],
};
