import type { CardDefinition } from '../../card';

// Real `S:Mode$ Continuous | Affected$ Permanent.Other+YouCtrl | AddAbility$ AnyMana`
// — grants EVERY OTHER permanent you control a mana ability, not one of its
// own. Genuinely different from `card.ts`'s new `CardDefinition
// .manaAbilities` (2026-09-14, ENGINE_GAPS.md gap #5) — that field
// structurally represents a permanent's OWN mana ability, the same way
// `continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`
// each have their own distinct "this permanent grants X to OTHERS"
// counterpart already built for keywords/P-T/creature-types. **Real,
// HARD-FLAGGED, new remaining gap, not silently folded into
// `manaAbilities`**: no "mana ability GRANT" mechanism (a `manaAbilities`
// analogue of `continuousKeywordGrants`) exists yet — this card's own real
// broadcast stays `staticAbilities` text until one is built. Not attempted
// this pass (no other real FIN card needs a mana-ability grant enforced
// today, checked) — flagged in ENGINE_GAPS.md as new remaining debt.
export const aRealmReborn: CardDefinition = {
  name: 'A Realm Reborn',
  manaCost: '{4}{G}{G}',
  typeLine: 'Enchantment',

  staticAbilities: ['Other permanents you control have "{T}: Add one mana of any color."'],
};
