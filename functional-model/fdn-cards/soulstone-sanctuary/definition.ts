import type { CardDefinition, Effect } from '../../card';

export const soulstoneSanctuary: CardDefinition = {
  name: 'Soulstone Sanctuary',
  manaCost: '',
  typeLine: 'Land',

  abilities: [
    {
      name: 'tapForC',
      cost: '{T}',
      effects: [{ kind: 'addMana', color: 'C', amount: 1 } satisfies Effect],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: "{4}: This land becomes a 3/3 creature with vigilance and all creature types. It's still a land.",
      demand:
        '`animate()` only adds a fixed, authored type-string array (no P/T-setting parameter, no "every creature type" wildcard) — needs a P/T override alongside `animate`, plus a genuine "all creature types" primitive distinct from a literal type list.',
    },
  ],
};
