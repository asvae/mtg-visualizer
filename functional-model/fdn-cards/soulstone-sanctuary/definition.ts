import type { CardDefinition, Effect } from '../../card';

// Real Forge (soulstone_sanctuary.txt): the animate ability sets a fixed
// 3/3 P/T and grants "all creature types" — `animate(target, types)` only
// ever ADDS a literal, authored type-string array (interfaces.ts), it has
// no P/T-setting parameter and no "every creature type" wildcard (hard-
// coding all ~250 real creature types would misrepresent this as a fixed
// authored list rather than the real dynamic "all" the card prints).
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
