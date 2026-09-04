import type { CardDefinition } from '../../card';

// Real script (iron_giant.txt): vanilla stats + three real keywords, no
// abilities/triggers of its own.
export const ironGiant: CardDefinition = {
  name: 'Iron Giant',
  manaCost: '{7}',
  typeLine: 'Artifact Creature — Demon',

  pt: [6, 6],
  keywords: ['Vigilance', 'Reach', 'Trample'],
};
