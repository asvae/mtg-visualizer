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
    // Real cost-reduction static — genuinely NOT the same shape
    // `costReduction.perControlled` now covers (2026-09-16 static-ability
    // audit — bartz-and-boko's/cantankerous-keepers'/valkyrie-aerial-unit's
    // own real "Affinity for <subtype/type> you control" is a
    // BATTLEFIELD-counted, single-subtype-or-type discount;
    // `engine.ts`'s own `effectiveCastCost` only ever counts
    // `caster.battlefield`). This card counts GRAVEYARD cards, and against
    // the broad, multi-type "permanent card" category (artifact, creature,
    // enchantment, land, or planeswalker card — not one single
    // subtype/type) — a genuinely different, still-open cost-reduction
    // shape, real but inert (ENGINE_GAPS.md gap #7's own still-open
    // remainder).
    'This spell costs {1} less to cast for each permanent card in your graveyard.',
  ],
};
