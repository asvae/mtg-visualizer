import type { CardDefinition } from '../../card';

export const bannerOfKinship: CardDefinition = {
  name: 'Banner of Kinship',
  manaCost: '{5}',
  typeLine: 'Artifact',

  missingSchemaFunctionality: [
    {
      clause:
        'As this artifact enters, choose a creature type. This artifact enters with a fellowship counter on it for each creature you control of the chosen type.\nCreatures you control of the chosen type get +1/+1 for each fellowship counter on this artifact.',
      demand:
        'No "remember a player-chosen creature type on this permanent, referenced by later static abilities/counter counts" primitive exists — every existing `subtype` filter (continuous grants, etc.) is a fixed, authored string, never a runtime choice.',
    },
  ],
};
