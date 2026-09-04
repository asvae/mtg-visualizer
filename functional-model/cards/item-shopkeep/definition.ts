import type { CardDefinition } from '../../card';

// "Whenever you attack, target attacking equipped creature gains menace
// until end of turn." — real, confirmed gap: the target needs to be BOTH
// attacking AND equipped, and neither predicate exists anywhere on `Card`
// (no `isAttacking()`/no `isEquipped()` — see barret-wallace's own comment
// for the same missing equipped-check; this model also has no attack-state
// tracking beyond the synthetic `dealsCombatDamage` probe, which doesn't
// mark a creature as "attacking" as a queryable, targetable fact). Building
// this trigger with `grantKeywordTarget`'s own unfiltered creature pool
// would silently drop both real restrictions — omitted rather than
// misrepresented; flagged to the parent session.
export const itemShopkeep: CardDefinition = {
  name: 'Item Shopkeep',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Human Citizen',

  pt: [2, 2],
};
