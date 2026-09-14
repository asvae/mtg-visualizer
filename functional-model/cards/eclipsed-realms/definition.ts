import type { CardDefinition } from '../../card';

export const eclipsedRealms: CardDefinition = {
  name: 'Eclipsed Realms',
  manaCost: '',
  typeLine: 'Land',

  // Same shape/gap as cavern-of-souls (a wider type-choice list, same
  // untrackable chosen-type state — real, separate, still-open gap). The
  // first mana ability is now a real, ordinary `manaAbilities` entry; the
  // second's real `restriction` (Forge `RestrictValid$
  // Spell.ChosenType,Activated.ChosenType`) is honestly typed but
  // deliberately unenforced, same reasoning cavern-of-souls' own comment
  // documents.
  staticAbilities: ['As this land enters, choose Elemental, Elf, Faerie, Giant, Goblin, Kithkin, Merfolk, or Treefolk.'],
  manaAbilities: [
    { colors: ['C'] },
    { colors: ['W', 'U', 'B', 'R', 'G'], restriction: 'Spend this mana only to cast a spell of the chosen type or activate an ability of a source of the chosen type.' },
  ],
};
