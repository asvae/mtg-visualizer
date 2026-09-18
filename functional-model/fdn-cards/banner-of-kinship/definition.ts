import type { CardDefinition } from '../../card';

// Real Forge (banner_of_kinship.txt): `SVar:ChooseCT:DB$ ChooseType |
// Defined$ You | Type$ Creature | ... | SubAbility$ DBCounters` — a
// player-chosen creature TYPE, remembered for this permanent's own
// lifetime, that both the ETB counter count AND the later continuous P/T
// grant both key off (`Affected$ Creature.ChosenType+YouCtrl`). No
// "remember a chosen creature type on this permanent, for later static
// abilities to read" primitive exists anywhere in this schema — every
// existing `subtype` filter (continuous grants, `putCounterAll`, etc.) is a
// FIXED, authored string, never a runtime player choice.
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
