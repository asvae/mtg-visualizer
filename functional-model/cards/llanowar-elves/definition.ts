import type { CardDefinition } from '../../card';

export const llanowarElves: CardDefinition = {
  name: 'Llanowar Elves',
  manaCost: '{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 1],

  // No engine support for mana abilities anywhere in this model (confirmed:
  // harness.ts assumes unlimited mana for casting, nothing tracks a
  // produced amount) — same documented gap elvish-archdruid's own mana
  // ability hits.
  staticAbilities: ['{T}: Add {G}.'],
};
