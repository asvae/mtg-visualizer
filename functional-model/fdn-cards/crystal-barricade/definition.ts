import type { CardDefinition } from '../../card';

export const crystalBarricade: CardDefinition = {
  name: 'Crystal Barricade',
  manaCost: '{1}{W}',
  typeLine: 'Artifact Creature — Wall',
  pt: [0, 4],
  keywords: ['Defender'],

  // You have hexproof.
  // Prevent all noncombat damage that would be dealt to other creatures you control.
  // Both of these are static replacement-effect rules that the engine doesn't yet model.
  // Hexproof on the player requires a player-level static grant (no such mechanism exists).
  // Noncombat damage prevention is a CR 614.2 replacement effect (ENGINE_GAPS.md gap #8).
  staticAbilities: [
    'You have hexproof.',
    'Prevent all noncombat damage that would be dealt to other creatures you control.',
  ],
};
