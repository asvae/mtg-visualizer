import type { CardDefinition } from '../../card';

export const eclipsedRealms: CardDefinition = {
  name: 'Eclipsed Realms',
  manaCost: '',
  typeLine: 'Land',

  // Same shape/gap as cavern-of-souls (a wider type-choice list, same
  // untrackable chosen-type state, same no-mana-engine gap).
  staticAbilities: [
    'As this land enters, choose Elemental, Elf, Faerie, Giant, Goblin, Kithkin, Merfolk, or Treefolk.',
    '{T}: Add {C}.',
    '{T}: Add one mana of any color. Spend this mana only to cast a spell of the chosen type or activate an ability of a source of the chosen type.',
  ],
};
