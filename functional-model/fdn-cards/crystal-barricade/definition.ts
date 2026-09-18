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
  // Migrated from `staticAbilities` to `missingSchemaFunctionality` (2026-09-18,
  // FDN schema-tightness redesign) — same real, unmodeled gaps, now declared
  // via the structured field instead of free text.
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
