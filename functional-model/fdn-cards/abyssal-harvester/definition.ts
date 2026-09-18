import type { CardDefinition } from '../../card';

export const abyssalHarvester: CardDefinition = {
  name: 'Abyssal Harvester',
  manaCost: '{1}{B}{B}',
  typeLine: 'Creature — Demon Warlock',
  pt: [3, 2],
  activationCost: '{T}',

  missingSchemaFunctionality: [
    {
      clause: "Exile target creature card from a graveyard that was put there this turn. Create a token that's a copy of it, except it's a Nightmare in addition to its other types. Then exile all other Nightmare tokens you control.",
      demand:
        'No "copy a permanent, with overrides" mechanic exists anywhere in this schema (the real, already-tracked gray-tier engine gap `createToken` only ever builds a fixed `TokenInfo`, never a copy of a chosen target with an added type) — and no field exists to filter a graveyard search to only cards that arrived THIS TURN, or to sweep-exile every other token this same card previously created.',
    },
  ],

  effects: [
    {
      kind: 'custom',
      describe: 'Exile target creature card from a graveyard that was put there this turn. Create a token that\'s a copy of it, except it\'s a Nightmare in addition to its other types. Then exile all other Nightmare tokens you control.',
      run: () => {},
    },
  ],
};
