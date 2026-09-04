import type { CardDefinition, Effect } from '../../card';

// Real script (the_regalia.txt): Legendary Artifact Vehicle, Haste, Crew 1.
// "Whenever The Regalia attacks, reveal cards from the top of your library
// until you reveal a land card. Put that card onto the battlefield tapped
// and the rest on the bottom of your library in a random order" — real
// `DigUntil` (forge-game's own dig-with-a-STOP-CONDITION shape: search
// until a match is found, unbounded, not a fixed `qty`). `card.ts`'s own
// `dig` Effect kind only covers a FIXED `qty` lookup (`DigEffect`, not
// `DigUntil`), and its `validType` union has no `'land'` option (only
// `'artifact'|'any'`) — both a real gap, not an invented workaround, kept
// as an honest no-op `custom` with the real text carried via `describe`.
export const theRegalia: CardDefinition = {
  name: 'The Regalia',
  manaCost: '{4}',
  typeLine: 'Legendary Artifact — Vehicle',

  pt: [4, 4],
  keywords: ['Haste'],
  crewCost: 1,

  triggers: [
    {
      name: 'onAttacks',
      effects: [
        {
          kind: 'custom',
          describe:
            'reveal cards from the top of your library until you reveal a land card; put that card onto the battlefield tapped and the rest on the bottom of your library in a random order (no unbounded "dig until a match" Effect shape, and no land validType, exist here — dig only covers a fixed qty and artifact/any)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
