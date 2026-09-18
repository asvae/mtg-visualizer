import type { CardDefinition } from '../../card';

export const crystalBarricade: CardDefinition = {
  name: 'Crystal Barricade',
  manaCost: '{1}{W}',
  typeLine: 'Artifact Creature — Wall',
  pt: [0, 4],
  keywords: ['Defender'],

  missingSchemaFunctionality: [
    {
      clause: 'You have hexproof.',
      demand: 'A player-level static grant mechanism — no field exists for a permanent to grant its CONTROLLING PLAYER hexproof; every real `Keyword`/`continuousKeywordGrants` entry today only ever targets a PERMANENT.',
    },
    {
      clause: 'Prevent all noncombat damage that would be dealt to other creatures you control.',
      demand: 'A CR 614.2-style damage-prevention replacement effect scoped to "noncombat damage only," broadcast to OTHER permanents a controller controls — `state.ts`\'s existing `DamagePrevention`/`CombatDamagePrevention` keywords (ENGINE_GAPS.md gaps #8/#8b) cover the opposite split (prevent ALL or COMBAT-ONLY damage to the permanent carrying the keyword itself), not "noncombat-only damage to OTHER creatures the controller controls."',
    },
  ],
};
