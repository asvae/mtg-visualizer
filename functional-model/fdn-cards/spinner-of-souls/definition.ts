import type { CardDefinition } from '../../card';

// Real Forge (spinner_of_souls.txt): `SVar:TrigDigUntil:DB$ DigUntil |
// Valid$ Creature | FoundDestination$ Hand | RevealedDestination$ Library |
// RevealedLibraryPosition$ -1 | RevealRandomOrder$ True` — a real "reveal
// cards from the top of your library UNTIL you reveal one matching a
// condition" mechanic, genuinely distinct from `kind:'dig'` (which only
// ever looks at a FIXED number of cards, never an open-ended search until a
// match). No such "look-until" primitive exists anywhere in this schema.
export const spinnerOfSouls: CardDefinition = {
  name: 'Spinner of Souls',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Spider Spirit',
  pt: [4, 3],
  keywords: ['Reach'],

  missingSchemaFunctionality: [
    {
      clause:
        'Whenever another nontoken creature you control dies, you may reveal cards from the top of your library until you reveal a creature card. Put that card into your hand and the rest on the bottom of your library in a random order.',
      demand:
        'No "reveal cards from the top of your library UNTIL one matches a condition" primitive exists — `kind:\'dig\'` only ever inspects a fixed `qty` of cards, never an open-ended search.',
    },
  ],
};
