import type { CardDefinition } from '../../card';

export const diamondWeapon: CardDefinition = {
  name: 'Diamond Weapon',
  manaCost: '{7}{G}{G}',
  typeLine: 'Legendary Artifact Creature — Elemental',

  pt: [8, 8],
  keywords: ['Reach'],

  staticAbilities: [
    // Real cost-reduction static — no cost-reduction machinery exists
    // anywhere in this model, same treatment travel-the-overworld's own
    // Affinity gets.
    'This spell costs {1} less to cast for each permanent card in your graveyard.',
    // Real damage-PREVENTION replacement effect — no replacement-effect
    // machinery exists anywhere in this model (state.ts's own header rules
    // this out), same treatment the-water-crystal's own mill-replacement
    // gets: real text, not mechanically enforced.
    'Immune — Prevent all combat damage that would be dealt to Diamond Weapon.',
  ],
};
