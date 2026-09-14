import type { CardDefinition, Effect } from '../../card';

// Real script (windurst_federation_center.txt) — same real "enters
// tapped" replacement effect and real, structured choice-of-color
// `manaAbilities` treatment as treno-dark-city's own doc comment explains
// in full; only the two colors produced differ.
export const windurstFederationCenter: CardDefinition = {
  name: 'Windurst, Federation Center',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  manaAbilities: [{ colors: ['G', 'W'] }],
};
