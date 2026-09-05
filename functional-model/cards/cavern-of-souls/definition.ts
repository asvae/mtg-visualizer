import type { CardDefinition } from '../../card';

export const cavernOfSouls: CardDefinition = {
  name: 'Cavern of Souls',
  manaCost: '',
  typeLine: 'Land',

  // "As this land enters, choose a creature type" has no state anywhere to
  // remember the chosen type across future activations (no per-permanent
  // "chosen type" field on RealCard) — same "no mana engine at all" gap
  // every mana ability in this deck hits, compounded with a real choice
  // this model also can't track.
  staticAbilities: ['As this land enters, choose a creature type.', '{T}: Add {C}.', '{T}: Add one mana of any color. Spend this mana only to cast a creature spell of the chosen type, and that spell can\'t be countered.'],
};
