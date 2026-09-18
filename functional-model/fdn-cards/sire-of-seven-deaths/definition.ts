import type { CardDefinition } from '../../card';

export const sireOfSevenDeaths: CardDefinition = {
  name: 'Sire of Seven Deaths',
  manaCost: '{7}',
  typeLine: 'Creature — Eldrazi',
  pt: [7, 7],
  keywords: ['Reach', 'FirstStrike', 'Vigilance', 'Menace', 'Trample', 'Lifelink', 'Ward'],

  keywordCosts: [{ keyword: 'Ward', cost: 'Pay 7 life' }],
};
