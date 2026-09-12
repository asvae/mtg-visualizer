import type { CardDefinition } from '../../card';

export const diamondWeapon: CardDefinition = {
  name: 'Diamond Weapon',
  manaCost: '{7}{G}{G}',
  typeLine: 'Legendary Artifact Creature — Elemental',

  pt: [8, 8],
  // 'CombatDamagePrevention' (ENGINE_GAPS.md gap #8, closed) — a real,
  // structured field replacing the old freeform `staticAbilities` text for
  // "Immune — Prevent all combat damage that would be dealt to Diamond
  // Weapon." Real Forge citation, `res/cardsfolder/d/diamond_weapon.txt`'s
  // own shipped script: `R:Event$ DamageDone | Prevent$ True | IsCombat$
  // True | ValidTarget$ Card.Self` — a real per-object `ReplacementEffect`
  // (general machinery this engine doesn't have), COMBAT damage only, to
  // itself only — checked at `state.dealDamage`'s own one real chokepoint
  // instead (see that method's own doc comment for the full citation/
  // scoping). Approximated via the SAME keyword-grant machinery a real
  // printed keyword like `Reach` already uses (card.ts's own `Keyword` doc
  // comment) — not a name-matched freeform string anymore.
  keywords: ['Reach', 'CombatDamagePrevention'],

  staticAbilities: [
    // Real cost-reduction static — no cost-reduction machinery exists
    // anywhere in this model, same treatment travel-the-overworld's own
    // Affinity gets. (Still real, still open — ENGINE_GAPS.md gap #7's own
    // still-open "generic cost reduction on a static ability" remainder;
    // unrelated to and NOT closed by this pass, which only closes the
    // combat-damage-prevention clause immediately below via `keywords`
    // above.)
    'This spell costs {1} less to cast for each permanent card in your graveyard.',
  ],
};
