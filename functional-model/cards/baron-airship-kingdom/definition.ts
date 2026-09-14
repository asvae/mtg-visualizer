import type { CardDefinition, Effect } from '../../card';

// Real script (baron_airship_kingdom.txt): a real nonbasic Land — Town.
// "This land enters tapped" is a real replacement effect, modeled as a
// real onEnter trigger tapping self — same precedent elixir's own
// "enters tapped" artifact establishes. The mana ability ("{T}: Add {U}
// or {R}") is a real, structured choice-of-color `manaAbilities` entry —
// see treno-dark-city's own doc comment for the full citation/mechanism.
export const baronAirshipKingdom: CardDefinition = {
  name: 'Baron, Airship Kingdom',
  manaCost: '',
  typeLine: 'Land — Town',

  manaAbilities: [{ colors: ['U', 'R'] }],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],
};
