import type { CardDefinition } from '../../card';

export const sireOfSevenDeaths: CardDefinition = {
  name: 'Sire of Seven Deaths',
  provenance: 'forge-json-compiler',
  manaCost: '{7}',
  typeLine: 'Creature — Eldrazi',
  pt: [7, 7],
  keywords: ['FirstStrike', 'Vigilance', 'Menace', 'Trample', 'Reach', 'Lifelink', 'Ward'],
  keywordCosts: [
    {
      keyword: 'Ward',
      cost: 'Pay 7 life',
    },
  ],
};
