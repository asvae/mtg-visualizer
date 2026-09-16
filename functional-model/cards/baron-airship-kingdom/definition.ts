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

  // recognizer-exception: entersBattlefield-self-trigger-structural — real
  // CR 614.12 "This land enters tapped" replacement effect, modeled as an
  // onEnter self-tap trigger (see treno-dark-city's own doc comment for the
  // full convention). No "When/Whenever <self> enters" clause exists in the
  // real printed text at all, so this recognizer correctly declines rather
  // than asserting a false sink fact.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],
};
