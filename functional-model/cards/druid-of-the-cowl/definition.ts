import type { CardDefinition } from '../../card';

export const druidOfTheCowl: CardDefinition = {
  name: 'Druid of the Cowl',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 3],

  // No engine support for mana abilities — same gap llanowar-elves hits.
  staticAbilities: ['{T}: Add {G}.'],
};
