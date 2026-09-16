import type { CardDefinition, Effect } from '../../card';

// Real script (gohn_town_of_ruin.txt) — same real "enters tapped"
// replacement effect and real, structured choice-of-color `manaAbilities`
// treatment as treno-dark-city's own doc comment explains in full (see
// that card for the citation); only the two colors produced differ.
export const gohnTownOfRuin: CardDefinition = {
  name: 'Gohn, Town of Ruin',
  manaCost: '',
  typeLine: 'Land — Town',

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

  manaAbilities: [{ colors: ['B', 'G'] }],
};
