import type { CardDefinition } from '../../card';

// Real `S:Mode$ Continuous | Affected$ Permanent.Other+YouCtrl | AddAbility$ AnyMana`
// — grants EVERY other permanent you control a mana ability. No Effect kind
// (nor any action in interfaces.ts) models mana production, and this is
// also a static ability grant to a GROUP of other permanents, not a
// resolvable step — same real scope boundary Goobbue Gardener's own mana
// ability and Cooking Campsite's own land mana ability already document.
export const aRealmReborn: CardDefinition = {
  name: 'A Realm Reborn',
  manaCost: '{4}{G}{G}',
  typeLine: 'Enchantment',

  staticAbilities: ['Other permanents you control have "{T}: Add one mana of any color."'],
};
