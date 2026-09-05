import type { CardDefinition, Effect } from '../../card';

export const woodlandWeavemaster: CardDefinition = {
  name: 'Woodland Weavemaster',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 2],
  keywords: ['Vigilance'],

  triggers: [
    {
      name: 'onOtherElfEnters',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 1 } satisfies Effect],
    },
  ],

  // Mana ability is documentary (no engine support) — doubly untestable
  // since its own amount is itself dynamic ("X mana... where X is this
  // creature's power").
  staticAbilities: ['{T}: Add X mana of any one color, where X is this creature\'s power. Spend this mana only to cast Elf spells and activate abilities of Elf sources.'],
};
